#requires -version 5.1
<#
    ⚠️⚠️ 本文件必须保存为「UTF-8 **带 BOM**」，否则必坏（改完记得检查！）⚠️⚠️
    本机 PowerShell 是 **5.1**（不是 pwsh 7）。5.1 读取“无 BOM”的 .ps1 时会按 **ANSI(CP936)**
    解码，于是文件里所有中文立刻变成乱码，并在解析期报
    `Unexpected token ...` / `The string is missing the terminator`（因为全角标点被拆成无效字节）。
    症状极具误导性：看起来像语法错误，其实是编码问题。
      自检（应为 239,187,191）：[System.IO.File]::ReadAllBytes($PSCommandPath)[0..2]
      修复（无 BOM 时补回）：$p='tools\sync-assets.ps1'; $b=[IO.File]::ReadAllBytes($p);
                            [IO.File]::WriteAllBytes($p, [byte[]](239,187,191) + $b)
    注意：很多编辑器/工具（含自动改写脚本）会静默去掉 BOM —— 每次改完这个文件都要复核一次。
#>
<#
    apk/tools/sync-assets.ps1
    ------------------------------------------------------------------
    把仓库里的“源码”同步成 APK 模块里的“生成物”：

      apk/pysrc/**            ->  apk/app/src/main/python/       （自举服务，入口模块 apk_server 必须在顶层）
      backend/app/**          ->  apk/app/src/main/python/app/   （保留 app 包层级；-OnlyBootstrap 时跳过）
      backend/prompts/**      ->  apk/app/src/main/python/prompts/（保留 prompts 层级；-OnlyBootstrap 时跳过）
      frontend/public/**      ->  apk/app/src/main/assets/web/   （-OnlyBootstrap 或 -NoWeb 时跳过）

    ⚠️ 为什么 app/ 与 prompts/ 这两级目录必须保留（拍平回去就会埋雷，且炸得很难定位）：
      后端代码全篇是**绝对包导入**（`from app.config import settings`、`from app import legal` …），
      且大量路径解析写作 `Path(__file__).resolve().parents[2] / "prompts"`
      （例：app/admin/router.py:80、app/methods/base.py:32、app/validation/validator.py:26）。
      以 python/app/admin/router.py 为例：parents[0]=python/app/admin、parents[1]=python/app、
      parents[2]=python —— 所以 prompts 必须落在 python/prompts/。
      一旦拍平到 python/ 根目录：`import app.*` 全部 ImportError；parents[2] 变成 python 的上级，
      所有 prompts 读取路径全部落空。
      自举服务（pysrc）只用标准库、不 import 后端，所以这个缺陷在 POC-0 阶段**不会暴露**，
      要等真正把后端跑起来时才炸 —— 这正是它危险的地方。

    ⚠️ 排除规则注意：**不要按目录名排除 data**（详见下方 $ExcludedDirNames 注释）。

    安全约定（重要）：
      * 只清理带标记的目录（python/.chaquopy-generated、web/.chaquopy-generated）。
        没标记就只做合并，绝不删除别人的文件。
      * 本脚本绝不触碰 app/src/main/assets/paipan/（那是另一个脚本生成的）。

    用法：
      powershell -ExecutionPolicy Bypass -File tools\sync-assets.ps1
      powershell -ExecutionPolicy Bypass -File tools\sync-assets.ps1 -OnlyBootstrap
      powershell -ExecutionPolicy Bypass -File tools\sync-assets.ps1 -NoWeb
#>
[CmdletBinding()]
param(
    # 只同步 apk/pysrc 里的自举服务，跳过 backend 与前端资源。
    [switch]$OnlyBootstrap,

    # 跳过前端静态资源（frontend/public -> assets/web）。
    [switch]$NoWeb
)

$ErrorActionPreference = 'Stop'

# ---------- 路径解析 ----------
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ApkDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$PythonSrc = Join-Path $ApkDir 'pysrc'
$PythonDest = Join-Path $ApkDir 'app\src\main\python'
$BackendAppSrc = Join-Path $RepoRoot 'backend\app'
$BackendPromptsSrc = Join-Path $RepoRoot 'backend\prompts'
# 目标：**保留包层级**（backend/app/** -> python/app/**；backend/prompts/** -> python/prompts/**）。
# 不能平铺进 python/ 根，否则 from app.x import y 与 parents[2]/prompts 全部失效（见文件头说明）。
$BackendAppDest = Join-Path $PythonDest 'app'
$BackendPromptsDest = Join-Path $PythonDest 'prompts'
$WebSrc = Join-Path $RepoRoot 'frontend\public'
$WebDest = Join-Path $ApkDir 'app\src\main\assets\web'

# 标记文件名（放在目标目录内部，用来判断“这个目录是我们生成的，可以整体重建”）
$PythonMarkerName = '.chaquopy-generated'
$WebMarkerName = '.chaquopy-generated'

# ---------- 排除规则（对所有拷贝生效） ----------
# 目录名：只要路径中任意一层目录叫这些名字，整棵子树跳过。
# ⚠️ 这里**不能**放 data：backend/app/data/（liuyao_yaoci.json 六爻爻辞）与
#    backend/app/mbti/data/（MBTI 题库 questions.json / questions-120.json / types.json）
#    是**运行时必需**的数据文件，被后端按 `parents[1] / "data"` 读取。
#    按目录名排除它们 = 静默丢文件（不报错、构建照过、运行到那一步才 500）。
#    真正不该进包的是 SQLite 数据库文件 —— 那是**扩展名**问题，见 $ExcludedExtensions。
$ExcludedDirNames = @('__pycache__', '.venv', 'node_modules', '.pytest_cache', 'tests')
# 文件名：系统垃圾文件。
$ExcludedFileNames = @('.DS_Store', 'Thumbs.db')
# 扩展名：编译产物 + 数据库文件（DB 进包 = 把本机数据一起发出去）。
$ExcludedExtensions = @('.pyc', '.pyo', '.db', '.db-shm', '.db-wal', '.db-journal', '.sqlite', '.sqlite3')

function Test-ExcludedDirectory {
    param([string]$Name)
    return ($ExcludedDirNames -contains $Name)
}

function Test-ExcludedFile {
    param([string]$Name)
    if ($ExcludedFileNames -contains $Name) {
        return $true
    }
    $ext = [System.IO.Path]::GetExtension($Name)
    if ([string]::IsNullOrEmpty($ext)) {
        return $false
    }
    return ($ExcludedExtensions -contains $ext.ToLowerInvariant())
}

# ---------- 拷贝实现 ----------
# 逐层递归拷贝：遇到被排除的目录名直接不进入，因此不会走进 node_modules / .venv。
function Copy-TreeLevel {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$DestDir
    )

    $count = 0

    if (-not (Test-Path -LiteralPath $DestDir -PathType Container)) {
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }

    foreach ($item in (Get-ChildItem -LiteralPath $SourceDir -Force)) {
        if ($item.PSIsContainer) {
            if (Test-ExcludedDirectory -Name $item.Name) {
                continue
            }
            $childDest = Join-Path $DestDir $item.Name
            $count += Copy-TreeLevel -SourceDir $item.FullName -DestDir $childDest
        }
        else {
            if (Test-ExcludedFile -Name $item.Name) {
                continue
            }
            $target = Join-Path $DestDir $item.Name
            Copy-Item -LiteralPath $item.FullName -Destination $target -Force
            $count++
        }
    }

    return $count
}

# 把 $SourceDir 的“内容”拷进 $DestDir（注意：拷的是内容，不是目录本身）。
# 这样 backend/app/foo.py -> app/src/main/python/foo.py，多来源可以平铺进同一个目录。
function Copy-Tree {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$DestDir,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$DestLabel
    )

    if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
        Write-Host "[sync] 警告：$Label 源目录不存在，已跳过：$SourceDir" -ForegroundColor Yellow
        return 0
    }

    $copied = Copy-TreeLevel -SourceDir $SourceDir -DestDir $DestDir
    Write-Host ("[sync] {0} -> {1}: {2} files" -f $Label, $DestLabel, $copied)
    Write-Host "       $DestDir"

    return $copied
}

# 清理策略：只有发现标记才整体重建；没有标记就保留已有内容，避免误删别人的文件。
function Reset-GeneratedDest {
    param(
        [Parameter(Mandatory = $true)][string]$DestDir,
        [Parameter(Mandatory = $true)][string]$MarkerName,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not (Test-Path -LiteralPath $DestDir -PathType Container)) {
        return
    }

    $markerPath = Join-Path $DestDir $MarkerName
    if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
        Write-Host "[sync] 发现标记 $MarkerName，重建目录（$Label）：$DestDir"
        Remove-Item -LiteralPath $DestDir -Recurse -Force
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }
    else {
        Write-Host "[sync] 未发现标记 $MarkerName，保留已有内容并合并（$Label）：$DestDir"
    }
}

# 拷贝成功后写标记；下次运行时凭标记重建，保证目录干净且幂等。
function Write-GeneratedMarker {
    param(
        [Parameter(Mandatory = $true)][string]$DestDir,
        [Parameter(Mandatory = $true)][string]$MarkerName,
        [Parameter(Mandatory = $true)][string]$Generator
    )

    if (-not (Test-Path -LiteralPath $DestDir -PathType Container)) {
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }

    $markerPath = Join-Path $DestDir $MarkerName
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $lines = @(
        "$Generator 自动生成，请勿手工修改。",
        "生成时间：$stamp",
        "此标记用于让脚本安全地整体重建本目录。"
    )
    Set-Content -LiteralPath $markerPath -Value $lines -Encoding UTF8
}

# ---------- 主流程 ----------
Write-Host '[sync] 开始同步 APK 内置资源'
Write-Host "[sync] 仓库根目录：$RepoRoot"
Write-Host "[sync] APK 模块目录：$ApkDir"

# 没有自举服务，APK 装上也是白屏，所以这里是致命错误。
if (-not (Test-Path -LiteralPath $PythonSrc -PathType Container)) {
    Write-Host "[sync] 致命错误：找不到自举服务源码目录 $PythonSrc（apk/pysrc）。" -ForegroundColor Red
    Write-Host '[sync] 应用必须包含该服务才能启动，已中止。' -ForegroundColor Red
    exit 1
}

$pysrcCount = 0
$backendAppCount = 0
$backendPromptsCount = 0
$webCount = 0

# 1) 自举服务：pysrc 的内容平铺到 python/ 顶层，入口模块 apk_server 必须在顶层。
Reset-GeneratedDest -DestDir $PythonDest -MarkerName $PythonMarkerName -Label 'python'
$pysrcCount = Copy-Tree -SourceDir $PythonSrc -DestDir $PythonDest -Label 'pysrc' -DestLabel 'python'

# 2) 后端 Python 代码与提示词：**保留包层级**放进 python/app 与 python/prompts
#    （与自举服务共用同一个 sys.path 根，但各自保留自己的包名，绝对导入与 parents[2] 才成立）。
if ($OnlyBootstrap) {
    Write-Host '[sync] -OnlyBootstrap：跳过 backend/app 与 backend/prompts'
}
else {
    $backendAppCount = Copy-Tree -SourceDir $BackendAppSrc -DestDir $BackendAppDest -Label 'backend/app' -DestLabel 'python/app'
    $backendPromptsCount = Copy-Tree -SourceDir $BackendPromptsSrc -DestDir $BackendPromptsDest -Label 'backend/prompts' -DestLabel 'python/prompts'
}

# 3) 前端静态资源。
if ($OnlyBootstrap) {
    Write-Host '[sync] -OnlyBootstrap：跳过 frontend/public 前端资源'
}
elseif ($NoWeb) {
    Write-Host '[sync] -NoWeb：跳过 frontend/public 前端资源'
}
else {
    Reset-GeneratedDest -DestDir $WebDest -MarkerName $WebMarkerName -Label 'assets/web'
    $webCount = Copy-Tree -SourceDir $WebSrc -DestDir $WebDest -Label 'frontend/public' -DestLabel 'assets/web'
}

# 4) 写标记（本次拷贝成功才写）。
Write-GeneratedMarker -DestDir $PythonDest -MarkerName $PythonMarkerName -Generator 'apk/tools/sync-assets.ps1'
if (-not $OnlyBootstrap -and -not $NoWeb) {
    Write-GeneratedMarker -DestDir $WebDest -MarkerName $WebMarkerName -Generator 'apk/tools/sync-assets.ps1'
}

# 5) 统计与汇总。
$total = $pysrcCount + $backendAppCount + $backendPromptsCount + $webCount

Write-Host ''
Write-Host '[sync] 同步完成，拷贝文件统计：'
Write-Host ("[sync] pysrc -> python: {0} files" -f $pysrcCount)
if (-not $OnlyBootstrap) {
    Write-Host ("[sync] backend/app -> python/app: {0} files" -f $backendAppCount)
    Write-Host ("[sync] backend/prompts -> python/prompts: {0} files" -f $backendPromptsCount)
}
if (-not $OnlyBootstrap -and -not $NoWeb) {
    Write-Host ("[sync] frontend/public -> assets/web: {0} files" -f $webCount)
}
Write-Host ("[sync] 合计：{0} files" -f $total)
Write-Host ''
Write-Host '[sync] 目标目录：'
Write-Host "       $PythonDest"
if (-not $OnlyBootstrap -and -not $NoWeb) {
    Write-Host "       $WebDest"
}
Write-Host ''
Write-Host '[sync] 提醒：app/src/main/python、app/src/main/assets/web 都是生成物，已在 .gitignore 中忽略，不要提交。'
Write-Host '[sync] 说明：本脚本不会碰 app/src/main/assets/paipan/（由排盘打包脚本生成）。'

exit 0
