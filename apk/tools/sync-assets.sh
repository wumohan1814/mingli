#!/usr/bin/env bash
#
# apk/tools/sync-assets.sh
# ------------------------------------------------------------------
# 与 apk/tools/sync-assets.ps1 行为一致的 Linux/macOS 版本，CI（ubuntu-latest）用这个。
#
# 同步关系：
#   apk/pysrc/**          ->  apk/app/src/main/python/         （自举服务，入口模块 apk_server 必须在顶层）
#   backend/app/**        ->  apk/app/src/main/python/app/     （保留 app 包层级；--only-bootstrap 时跳过）
#   backend/prompts/**    ->  apk/app/src/main/python/prompts/ （保留 prompts 层级；--only-bootstrap 时跳过）
#   frontend/public/**    ->  apk/app/src/main/assets/web/     （--only-bootstrap 或 --no-web 时跳过）
#
# ⚠️ 为什么 app/ 与 prompts/ 这两级目录必须保留（拍平回去就会埋雷，且炸得很难定位）：
#   后端代码全篇是**绝对包导入**（`from app.config import settings`、`from app import legal` …），
#   且大量路径解析写作 `Path(__file__).resolve().parents[2] / "prompts"`
#   （例：app/admin/router.py:80、app/methods/base.py:32、app/validation/validator.py:26）。
#   以 python/app/admin/router.py 为例：parents[0]=python/app/admin、parents[1]=python/app、
#   parents[2]=python —— 所以 prompts 必须落在 python/prompts/。
#   一旦拍平到 python/ 根目录：`import app.*` 全部 ImportError；parents[2] 变成 python 的上级，
#   所有 prompts 读取路径全部落空。
#   自举服务（pysrc）只用标准库、不 import 后端，所以这个缺陷在 POC-0 阶段**不会暴露**，
#   要等真正把后端跑起来时才炸 —— 这正是它危险的地方。
#
# ⚠️ 排除规则注意：**不要按目录名排除 data**（详见下方 is_excluded_dir_path 注释）。
#
# 安全约定：
#   * 只清理带标记的目录（python/.chaquopy-generated、web/.chaquopy-generated）；
#     没有标记就只合并，绝不删除别人的文件。
#   * 本脚本绝不触碰 app/src/main/assets/paipan/。
#
# 用法：
#   bash apk/tools/sync-assets.sh
#   bash apk/tools/sync-assets.sh --only-bootstrap
#   bash apk/tools/sync-assets.sh --no-web
#
# 注意：请让本文件在版本库中保持可执行位（git 记录的 100755）。
#       如果 clone / 拷贝后丢了执行位，用下面命令补回来：
#         chmod +x apk/tools/sync-assets.sh
# ------------------------------------------------------------------

set -euo pipefail

ONLY_BOOTSTRAP=0
NO_WEB=0

for arg in "$@"; do
  case "$arg" in
    --only-bootstrap)
      ONLY_BOOTSTRAP=1
      ;;
    --no-web)
      NO_WEB=1
      ;;
    -h|--help)
      echo "用法: $0 [--only-bootstrap] [--no-web]"
      exit 0
      ;;
    *)
      echo "[sync] 未知参数：$arg" >&2
      echo "用法: $0 [--only-bootstrap] [--no-web]" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PYSRC="$APK_DIR/pysrc"
PY_DEST="$APK_DIR/app/src/main/python"
BACKEND_APP_SRC="$REPO_ROOT/backend/app"
BACKEND_PROMPTS_SRC="$REPO_ROOT/backend/prompts"
# 目标：**保留包层级**（backend/app/** -> python/app/**；backend/prompts/** -> python/prompts/**）。
# 不能平铺进 python/ 根，否则 from app.x import y 与 parents[2]/prompts 全部失效（见文件头说明）。
PY_APP_DEST="$PY_DEST/app"
PY_PROMPTS_DEST="$PY_DEST/prompts"
WEB_SRC="$REPO_ROOT/frontend/public"
WEB_DEST="$APK_DIR/app/src/main/assets/web"

MARKER_NAME=".chaquopy-generated"

# ---------------- 排除规则（对所有拷贝生效） ----------------

# 只检查目录部分：命中排除清单里任意一层目录名就跳过整棵子树。
# ⚠️ 这里**不能**放 data：backend/app/data/（liuyao_yaoci.json 六爻爻辞）与
#    backend/app/mbti/data/（MBTI 题库 questions.json / questions-120.json / types.json）
#    是**运行时必需**的数据文件，被后端按 `parents[1] / "data"` 读取。
#    按目录名排除它们 = 静默丢文件（不报错、构建照过、运行到那一步才 500）。
#    真正不该进包的是 SQLite 数据库文件 —— 那是**扩展名**问题，见 is_excluded_file_name。
is_excluded_dir_path() {
  local rel="$1"
  local dirs=""
  case "$rel" in
    */*) dirs="${rel%/*}" ;;
    *) dirs="" ;;
  esac
  if [ -z "$dirs" ]; then
    return 1
  fi
  local part
  local old_ifs="$IFS"
  IFS='/'
  for part in $dirs; do
    case "$part" in
      __pycache__|.venv|node_modules|.pytest_cache|tests)
        IFS="$old_ifs"
        return 0
        ;;
    esac
  done
  IFS="$old_ifs"
  return 1
}

is_excluded_file_name() {
  local name="$1"
  case "$name" in
    .DS_Store|Thumbs.db)
      return 0
      ;;
  esac
  # 编译产物 + 数据库文件（DB 进包 = 把本机数据一起发出去）。
  case "$name" in
    *.pyc|*.pyo|*.db|*.db-shm|*.db-wal|*.db-journal|*.sqlite|*.sqlite3)
      return 0
      ;;
  esac
  return 1
}

# ---------------- 拷贝 ----------------

# 把 $src 的“内容”拷进 $dest（拷内容，不是拷目录本身），
# 因此 backend/app/foo.py -> app/src/main/python/foo.py，多来源可以平铺进同一目录。
# 只把拷贝数量打到 stdout，其余信息一律走 stderr，便于调用方用 $() 取值。
copy_tree() {
  local label="$1"
  local src="$2"
  local dest="$3"
  local dest_label="$4"

  if [ ! -d "$src" ]; then
    echo "[sync] 警告：$label 源目录不存在，已跳过：$src" >&2
    echo 0
    return 0
  fi

  mkdir -p "$dest"

  local count=0
  local rel name dir
  while IFS= read -r -d '' file; do
    rel="${file#"$src"/}"
    name="${rel##*/}"

    if is_excluded_file_name "$name"; then
      continue
    fi
    if is_excluded_dir_path "$rel"; then
      continue
    fi

    dir="$(dirname "$rel")"
    mkdir -p "$dest/$dir"
    cp -p "$file" "$dest/$rel"
    count=$((count + 1))
  done < <(find "$src" -type f -print0)

  echo "$count"
}

# ---------------- 标记与清理 ----------------

reset_generated_dest() {
  local dest="$1"
  local label="$2"

  if [ -d "$dest" ] && [ -f "$dest/$MARKER_NAME" ]; then
    echo "[sync] 发现标记 $MARKER_NAME，重建目录（$label）：$dest"
    rm -rf "$dest"
    mkdir -p "$dest"
  elif [ -d "$dest" ]; then
    echo "[sync] 未发现标记 $MARKER_NAME，保留已有内容并合并（$label）：$dest"
  else
    echo "[sync] 目标目录不存在，将新建（$label）：$dest"
  fi
}

write_generated_marker() {
  local dest="$1"
  local generator="$2"

  mkdir -p "$dest"
  {
    echo "$generator 自动生成，请勿手工修改。"
    echo "生成时间：$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "此标记用于让脚本安全地整体重建本目录。"
  } > "$dest/$MARKER_NAME"
}

# ---------------- 主流程 ----------------

echo "[sync] 开始同步 APK 内置资源"
echo "[sync] 仓库根目录：$REPO_ROOT"
echo "[sync] APK 模块目录：$APK_DIR"

# 没有自举服务，APK 装上也是白屏，所以这里是致命错误。
if [ ! -d "$PYSRC" ]; then
  echo "[sync] 致命错误：找不到自举服务源码目录 $PYSRC（apk/pysrc）。" >&2
  echo "[sync] 应用必须包含该服务才能启动，已中止。" >&2
  exit 1
fi

pysrc_count=0
backend_app_count=0
backend_prompts_count=0
web_count=0

# 1) 自举服务：pysrc 的内容平铺到 python/ 顶层，入口模块 apk_server 必须在顶层。
reset_generated_dest "$PY_DEST" "python"
pysrc_count="$(copy_tree "pysrc" "$PYSRC" "$PY_DEST" "python")"
echo "[sync] pysrc -> python: $pysrc_count files"
echo "       $PY_DEST"

# 2) 后端 Python 代码与提示词：**保留包层级**放进 python/app 与 python/prompts
#    （与自举服务共用同一个 sys.path 根，但各自保留自己的包名，绝对导入与 parents[2] 才成立）。
if [ "$ONLY_BOOTSTRAP" -eq 1 ]; then
  echo "[sync] --only-bootstrap：跳过 backend/app 与 backend/prompts"
else
  backend_app_count="$(copy_tree "backend/app" "$BACKEND_APP_SRC" "$PY_APP_DEST" "python/app")"
  echo "[sync] backend/app -> python/app: $backend_app_count files"
  backend_prompts_count="$(copy_tree "backend/prompts" "$BACKEND_PROMPTS_SRC" "$PY_PROMPTS_DEST" "python/prompts")"
  echo "[sync] backend/prompts -> python/prompts: $backend_prompts_count files"
  echo "       $PY_DEST"
fi

# 3) 前端静态资源。
if [ "$ONLY_BOOTSTRAP" -eq 1 ]; then
  echo "[sync] --only-bootstrap：跳过 frontend/public 前端资源"
elif [ "$NO_WEB" -eq 1 ]; then
  echo "[sync] --no-web：跳过 frontend/public 前端资源"
else
  reset_generated_dest "$WEB_DEST" "assets/web"
  web_count="$(copy_tree "frontend/public" "$WEB_SRC" "$WEB_DEST" "assets/web")"
  echo "[sync] frontend/public -> assets/web: $web_count files"
  echo "       $WEB_DEST"
fi

# 4) 写标记（本次拷贝成功才写）。
write_generated_marker "$PY_DEST" "apk/tools/sync-assets.sh"
if [ "$ONLY_BOOTSTRAP" -eq 0 ] && [ "$NO_WEB" -eq 0 ]; then
  write_generated_marker "$WEB_DEST" "apk/tools/sync-assets.sh"
fi

# 5) 汇总。
total=$((pysrc_count + backend_app_count + backend_prompts_count + web_count))

echo ""
echo "[sync] 同步完成，拷贝文件统计："
echo "[sync] pysrc -> python: $pysrc_count files"
if [ "$ONLY_BOOTSTRAP" -eq 0 ]; then
  echo "[sync] backend/app -> python/app: $backend_app_count files"
  echo "[sync] backend/prompts -> python/prompts: $backend_prompts_count files"
fi
if [ "$ONLY_BOOTSTRAP" -eq 0 ] && [ "$NO_WEB" -eq 0 ]; then
  echo "[sync] frontend/public -> assets/web: $web_count files"
fi
echo "[sync] 合计：$total files"
echo ""
echo "[sync] 目标目录："
echo "       $PY_DEST"
if [ "$ONLY_BOOTSTRAP" -eq 0 ] && [ "$NO_WEB" -eq 0 ]; then
  echo "       $WEB_DEST"
fi
echo ""
echo "[sync] 提醒：app/src/main/python、app/src/main/assets/web 都是生成物，已在 .gitignore 中忽略，不要提交。"
echo "[sync] 说明：本脚本不会碰 app/src/main/assets/paipan/（由排盘打包脚本生成）。"

# 别忘了保持执行位（git 里应为 100755）：
#   chmod +x apk/tools/sync-assets.sh
# 或者用 bash apk/tools/sync-assets.sh 显式调用，不依赖执行位。

exit 0
