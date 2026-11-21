#!/usr/bin/env python3
"""Store Instagram Graph API credentials locally with owner-only permissions."""

import getpass
import json
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

CONFIG_PATH = Path.home() / ".config" / "lypid" / "instagram-graph.json"
GRAPH_VERSION = "v27.0"


def exchange_for_long_lived_token(app_id, app_secret, short_lived_token):
    query = urlencode({
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_lived_token,
    })
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/oauth/access_token?{query}"
    with urlopen(url, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    token = payload.get("access_token")
    if not token:
        raise ValueError("Meta 沒有回傳長效存取權杖")
    return token


def main():
    print("此工具只將 Meta Instagram API 授權資料保存在本機，不會上傳或修改試算表。")
    print("請先在 Meta 開發者平台完成 Business Discovery 授權。所有權杖及 App Secret 僅在本機輸入，不要貼到聊天或文件中。")
    instagram_user_id = input("公司 Instagram 專業帳號 ID：").strip()
    exchange = input("要在本機將短效權杖交換為長效權杖嗎？[Y/n] ").strip().lower() not in {"n", "no"}
    if exchange:
        app_id = input("Meta App ID：").strip()
        app_secret = getpass.getpass("Meta App Secret（輸入時不會顯示）：").strip()
        short_lived_token = getpass.getpass("Meta 短效使用者權杖（輸入時不會顯示）：").strip()
        if not app_id or not app_secret or not short_lived_token:
            print("App ID、App Secret 和短效權杖都必須填寫。", file=sys.stderr)
            return 2
        try:
            access_token = exchange_for_long_lived_token(app_id, app_secret, short_lived_token)
        except Exception as error:
            print(f"Meta 權杖交換失敗：{error}", file=sys.stderr)
            return 1
    else:
        access_token = getpass.getpass("Instagram Graph API 長效存取權杖（輸入時不會顯示）：").strip()
    if not instagram_user_id or not access_token:
        print("帳號 ID 和存取權杖都必須填寫。", file=sys.stderr)
        return 2

    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    CONFIG_PATH.parent.chmod(0o700)
    handle, temporary_path = tempfile.mkstemp(prefix="instagram-graph-", suffix=".json", dir=CONFIG_PATH.parent)
    try:
        os.fchmod(handle, 0o600)
        with os.fdopen(handle, "w", encoding="utf-8") as config_file:
            json.dump({"instagramUserId": instagram_user_id, "accessToken": access_token}, config_file)
            config_file.write("\n")
        os.replace(temporary_path, CONFIG_PATH)
        CONFIG_PATH.chmod(0o600)
    except Exception:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise

    print(f"已安全儲存本機設定：{CONFIG_PATH}")
    print("下一次每小時同步會開始檢查符合資格的公開 Instagram 專業帳號；每個帳號最多每 24 小時查詢一次。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
