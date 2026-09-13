#!/bin/bash
# 命理 · SQLite 每日备份脚本
# 建议 crontab: 0 3 * * * /bin/bash /opt/mingli/app/ops/deploy/backup.sh
set -e

DATA_DIR="/opt/mingli/data"
BACKUP_DIR="/opt/mingli/backup"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

# 逐库备份（带日期后缀）
for db in "$DATA_DIR"/*.db; do
  [ -e "$db" ] || continue
  name=$(basename "$db" .db)
  cp "$db" "$BACKUP_DIR/${name}_${DATE}.db"
done

# 清理 7 天前的旧备份
find "$BACKUP_DIR" -name '*.db' -mtime +${KEEP_DAYS} -delete

echo "[backup] $(date '+%F %T') 完成，保留最近 ${KEEP_DAYS} 天"
ls -lh "$BACKUP_DIR" | tail -n +2
