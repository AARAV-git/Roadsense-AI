"""
RoadSense AI - Results Extractor
Queries roadsense.db and prints:
  1. Trust calibration scenario summary
  2. Alert type distribution
  3. Chaos score statistics
  4. False positive reduction estimate
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "roadsense.db")

def run():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    print("=" * 60)
    print("1. TRUST CALIBRATION SUMMARY (from frames table)")
    print("=" * 60)
    # Classify rows by trust_weight ranges derived from fusion.py logic
    # agreed: w = 0.6 + 0.4*fresh*sensor_conf  -> w > 0.5 means confirmed
    # not agreed: w = 0.4 + 0.1*fresh          -> w <= 0.5
    cur.execute("""
        SELECT
            CASE
                WHEN trust_weight > 0.5 THEN 'confirmed (IMU+Vision)'
                WHEN trust_weight > 0.4 THEN 'camera_only_fresh'
                ELSE 'camera_only_stale'
            END as reason,
            COUNT(*) as count,
            ROUND(AVG(vision_conf), 3)  as avg_vision_conf,
            ROUND(AVG(trust_weight), 3) as avg_trust_weight,
            ROUND(AVG(final_conf), 3)   as avg_final_conf,
            ROUND(MIN(trust_weight), 3) as min_w,
            ROUND(MAX(trust_weight), 3) as max_w
        FROM frames
        WHERE vision_conf IS NOT NULL
        GROUP BY reason
        ORDER BY count DESC
    """)
    rows = cur.fetchall()
    if rows:
        print(f"{'Reason':<25} {'Count':>6} {'Avg Cvis':>9} {'Avg w':>7} {'Avg Cfinal':>11} {'Min w':>7} {'Max w':>7}")
        print("-" * 80)
        for r in rows:
            print(f"{r['reason']:<25} {r['count']:>6} {r['avg_vision_conf']:>9} {r['avg_trust_weight']:>7} {r['avg_final_conf']:>11} {r['min_w']:>7} {r['max_w']:>7}")
    else:
        print("  No frame data with vision events found.")

    print()
    print("=" * 60)
    print("2. ALERT TYPE DISTRIBUTION (from alerts table)")
    print("=" * 60)
    cur.execute("""
        SELECT alert_type,
               COUNT(*) as total,
               ROUND(AVG(vision_confidence), 3)  as avg_vis_conf,
               ROUND(AVG(trust_weight), 3)        as avg_trust_w,
               ROUND(AVG(final_confidence), 3)    as avg_final_conf,
               ROUND(MIN(final_confidence), 3)    as min_final,
               ROUND(MAX(final_confidence), 3)    as max_final
        FROM alerts
        GROUP BY alert_type
        ORDER BY total DESC
    """)
    rows = cur.fetchall()
    if rows:
        print(f"{'Alert Type':<22} {'Count':>6} {'Avg Cvis':>9} {'Avg w':>7} {'Avg Cfinal':>11} {'Min':>6} {'Max':>6}")
        print("-" * 75)
        for r in rows:
            print(f"{r['alert_type']:<22} {r['total']:>6} {r['avg_vis_conf']:>9} {r['avg_trust_w']:>7} {r['avg_final_conf']:>11} {r['min_final']:>6} {r['max_final']:>6}")
    else:
        print("  No alert records found.")

    print()
    print("=" * 60)
    print("3. CHAOS SCORE STATISTICS (from frames table)")
    print("=" * 60)
    cur.execute("""
        SELECT COUNT(*) as total_frames,
               ROUND(AVG(chaos_score), 3)  as avg_chaos,
               ROUND(MIN(chaos_score), 3)  as min_chaos,
               ROUND(MAX(chaos_score), 3)  as max_chaos,
               ROUND(AVG(detection_count), 1) as avg_detections
        FROM frames
    """)
    r = cur.fetchone()
    if r and r['total_frames'] > 0:
        print(f"  Total frame ticks logged : {r['total_frames']}")
        print(f"  Avg chaos score          : {r['avg_chaos']}")
        print(f"  Min chaos score          : {r['min_chaos']}")
        print(f"  Max chaos score          : {r['max_chaos']}")
        print(f"  Avg detections per tick  : {r['avg_detections']}")
    else:
        print("  No frame data found.")

    print()
    print("=" * 60)
    print("4. FALSE POSITIVE REDUCTION ESTIMATE")
    print("=" * 60)
    cur.execute("""
        SELECT COUNT(*) as total FROM alerts WHERE vision_confidence IS NOT NULL
    """)
    total_vis = cur.fetchone()['total']

    cur.execute("""
        SELECT COUNT(*) as suppressed FROM alerts
        WHERE vision_confidence IS NOT NULL
          AND final_confidence < 0.55
    """)
    suppressed = cur.fetchone()['suppressed']

    if total_vis > 0:
        reduction_pct = round(suppressed / total_vis * 100, 1)
        print(f"  Total vision-triggered events : {total_vis}")
        print(f"  Suppressed by trust calibration: {suppressed}")
        print(f"  False alarm reduction rate    : {reduction_pct}%")
    else:
        print("  No alert data to compute reduction.")

    print()
    print("=" * 60)
    print("5. SESSION SUMMARY")
    print("=" * 60)
    cur.execute("""
        SELECT id, name, source, status, started_at, ended_at
        FROM sessions ORDER BY id DESC LIMIT 10
    """)
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print(f"  Session {r['id']:>3}: [{r['status']:<10}] {r['name']} ({r['source']}) | {r['started_at']}")
    else:
        print("  No sessions found.")

    con.close()
    print()
    print("Done.")

if __name__ == "__main__":
    run()
