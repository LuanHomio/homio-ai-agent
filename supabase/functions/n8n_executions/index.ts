import { serve } from "https://deno.land/std/http/server.ts";

serve(async () => {
  const logs = [
    {"timestamp":1767791817118000,"execution_time_ms":623},
    {"timestamp":1767791677400000,"execution_time_ms":453},
    {"timestamp":1767791649615000,"execution_time_ms":526},
    {"timestamp":1767791647419000,"execution_time_ms":507},
    {"timestamp":1767791646953000,"execution_time_ms":462},
    {"timestamp":1767791628856000,"execution_time_ms":572},
    {"timestamp":1767791601351000,"execution_time_ms":533},
    {"timestamp":1767791598995000,"execution_time_ms":548},
    {"timestamp":1767791546610000,"execution_time_ms":560},
    {"timestamp":1767791510885000,"execution_time_ms":537},
    {"timestamp":1767791476528000,"execution_time_ms":2229},
    {"timestamp":1767791476513000,"execution_time_ms":553},
    {"timestamp":1767791468965000,"execution_time_ms":531},
    {"timestamp":1767791455566000,"execution_time_ms":580},
    {"timestamp":1767791445276000,"execution_time_ms":2463},
    {"timestamp":1767791445259000,"execution_time_ms":477},
    {"timestamp":1767791440380000,"execution_time_ms":810},
    {"timestamp":1767791425473000,"execution_time_ms":563},
    {"timestamp":1767791393759000,"execution_time_ms":610},
    {"timestamp":1767791353938000,"execution_time_ms":543},
    {"timestamp":1767791313929000,"execution_time_ms":612},
    {"timestamp":1767791279709000,"execution_time_ms":525},
    {"timestamp":1767791279555000,"execution_time_ms":1129},
    {"timestamp":1767791271511000,"execution_time_ms":1578}
  ];

  const analysis = {
    total_requests: logs.length,
    time_gaps: [],
    debounce_violations: [],
    suspicious_patterns: []
  };

  for (let i = 1; i < logs.length; i++) {
    const prevTime = logs[i-1].timestamp / 1000000;
    const currTime = logs[i].timestamp / 1000000;
    const gapMs = currTime - prevTime;
    const gapSeconds = gapMs / 1000;

    analysis.time_gaps.push({
      between: `${i-1} -> ${i}`,
      gap_ms: gapMs,
      gap_seconds: gapSeconds.toFixed(3),
      prev_timestamp: new Date(prevTime).toISOString(),
      curr_timestamp: new Date(currTime).toISOString()
    });

    if (gapSeconds < 6) {
      analysis.debounce_violations.push({
        execution1: i-1,
        execution2: i,
        gap_seconds: gapSeconds.toFixed(3),
        prev_timestamp: new Date(prevTime).toISOString(),
        curr_timestamp: new Date(currTime).toISOString()
      });
    }

    if (gapSeconds < 1) {
      analysis.suspicious_patterns.push({
        execution1: i-1,
        execution2: i,
        gap_seconds: gapSeconds.toFixed(3),
        description: "Execuções quase simultâneas"
      });
    }
  }

  const today = new Date();
  today.setHours(10, 9, 0, 0);
  const targetTime = today.getTime();
  const windowMs = 30 * 60 * 1000;

  const around10_09 = logs.filter(log => {
    const logTime = log.timestamp / 1000000;
    return Math.abs(logTime - targetTime) <= windowMs;
  });

  return new Response(JSON.stringify({
    analysis,
    around_10_09: {
      count: around10_09.length,
      executions: around10_09.map((log, idx) => ({
        index: idx,
        timestamp: new Date(log.timestamp / 1000000).toISOString(),
        execution_time_ms: log.execution_time_ms
      }))
    },
    debounce_window_ms: 6000,
    conclusion: analysis.debounce_violations.length > 0 
      ? `⚠️ ${analysis.debounce_violations.length} violações de debounce detectadas (gap < 6s)`
      : "✅ Nenhuma violação de debounce detectada"
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
