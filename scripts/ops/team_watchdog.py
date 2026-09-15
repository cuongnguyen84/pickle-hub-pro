#!/usr/bin/env python3
"""Independent local heartbeat check. Does not detect whole-host/network loss."""
import fcntl
import json
import time

from team_store import Store
import team_supervisor as team


def main():
    store = Store(team.ROOT)
    with open(team.ROOT / "watchdog.lock", "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        heartbeat = store.get("heartbeat", 0)
        paused = store.get("paused", False)
        stale = not paused and time.time() - heartbeat > 1200
        if stale and not store.get("watchdog_alert", False):
            store.enqueue(f"watchdog:{time.time()}", "⚠️ Đội agent v2 không hoàn thành lượt chạy trong hơn 20 phút. Job phục hồi hạ tầng vẫn có lịch riêng. Kiểm tra team-v2.log; không tự chạy lại tác vụ ghi đang dở.")
        elif not stale and store.get("watchdog_alert", False):
            store.enqueue(f"watchdog-recovered:{time.time()}", "Đội agent v2 đã có heartbeat trở lại hoặc được chủ động tạm dừng.")
        store.put("watchdog_alert", stale)
        store.task("supervisor-heartbeat", "platform", "Heartbeat đội v2 quá hạn", "open" if stale else "resolved", {"heartbeat": heartbeat})
        team.flush(store)
        print(json.dumps({"stale": stale, "paused": paused}))


if __name__ == "__main__":
    main()
