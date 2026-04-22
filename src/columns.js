// ── Column definitions ────────────────────────────────────────────────────
// 2025 Stats columns
const trendTip = 'Trend = how 2026 projections compare to 2025 actuals across all league categories. Positive (green) = projecting improvement, negative (red) = projecting decline. Computed as sum of z-scored deltas across AVG/OBP/SLG/HR/R/RBI/SB/K (batters) or ERA/WHIP/K/W/SV/HD/HRA/QS (pitchers).';
const batCols25 = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'age',label:'Age',w:40}, {key:'dp',label:'Pick',w:55,cls:'pnav-col'},
  {key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip},
  {key:'s25_pa',label:'PA',w:50}, {key:'s25_avg',label:'AVG',w:55}, {key:'s25_obp',label:'OBP',w:55},
  {key:'s25_slg',label:'SLG',w:55}, {key:'s25_hr',label:'HR',w:45}, {key:'s25_r',label:'R',w:45},
  {key:'s25_rbi',label:'RBI',w:45}, {key:'s25_sb',label:'SB',w:45}, {key:'s25_so',label:'K',w:45},
  {key:'s25_barrel',label:'Brl%',w:50,tip:'Barrel rate: batted balls with optimal launch angle + exit velo'}, {key:'s25_hardhit',label:'HH%',w:50,tip:'Hard hit rate: batted balls with 95+ mph exit velocity'},
  {key:'s25_woba',label:'wOBA',w:55,tip:'Weighted On-Base Average: offensive value on a per-PA basis'}, {key:'s25_xwoba',label:'xwOBA',w:55,tip:'Expected wOBA based on exit velocity and launch angle'},
  {key:'s25_delta',label:'xw\u0394',w:50,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'}
];
const pitCols25 = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:50},
  {key:'age',label:'Age',w:40}, {key:'dp',label:'Pick',w:55,cls:'pnav-col'},
  {key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip},
  {key:'s25_ip',label:'IP',w:50}, {key:'s25_era',label:'ERA',w:55}, {key:'s25_whip',label:'WHIP',w:60},
  {key:'s25_so',label:'K',w:50}, {key:'s25_w',label:'W',w:40}, {key:'s25_sv',label:'SV',w:40},
  {key:'s25_hld',label:'HD',w:40}, {key:'s25_qs',label:'QS',w:40}, {key:'s25_hr',label:'HRA',w:45},
  {key:'s25_stuff',label:'Stf+',w:50,tip:'Stuff+ measures pitch quality based on movement/velo. 100=avg'},
  {key:'s25_loc',label:'Loc+',w:50,tip:'Location+ measures command/control. 100=avg'},
  // s25_pitching (Stf+ × Loc+ combo) removed — components shown instead
];
// Unified All-tab columns for 2025: bat+pit stats in one row (non-applicable show —)
const allCols25 = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'type',label:'Type',w:50}, {key:'age',label:'Age',w:40}, {key:'lcv',label:'LCV',w:55,cls:'lcv-col'}, {key:'tradeValue',label:'TV',w:55,tip:'Trade value: production + keeper premium + prospect value'},
  {key:'dp',label:'Pick',w:55,cls:'pnav-col'},
  {key:'trend',label:'Trend',w:55,cls:'pnav-col',tip:trendTip},
  {key:'s25_pa',label:'PA',w:45}, {key:'s25_avg',label:'AVG',w:50}, {key:'s25_obp',label:'OBP',w:50},
  {key:'s25_slg',label:'SLG',w:50}, {key:'s25_r',label:'R',w:38}, {key:'s25_rbi',label:'RBI',w:38},
  {key:'s25_sb',label:'SB',w:38}, {key:'s25_hr',label:'HR',w:38}, {key:'s25_so',label:'K',w:38},
  {key:'s25_ip',label:'IP',w:45}, {key:'s25_era',label:'ERA',w:50}, {key:'s25_whip',label:'WHIP',w:55},
  {key:'s25_w',label:'W',w:38}, {key:'s25_sv',label:'SV',w:38},
  {key:'s25_hld',label:'HD',w:38}, {key:'s25_qs',label:'QS',w:38},
  {key:'s25_barrel',label:'Brl%',w:48,tip:'Barrel rate: optimal launch angle + exit velo'}, {key:'s25_hardhit',label:'HH%',w:48,tip:'Hard hit rate: 95+ mph exit velocity'},
  {key:'s25_woba',label:'wOBA',w:50,tip:'Weighted On-Base Average'}, {key:'s25_xwoba',label:'xwOBA',w:52,tip:'Expected wOBA (Statcast)'},
  {key:'s25_delta',label:'xw\u0394',w:48,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'},
  {key:'s25_stuff',label:'Stf+',w:48,tip:'Stuff+ measures pitch quality. 100=avg'},
  {key:'s25_loc',label:'Loc+',w:48,tip:'Location+. 100=avg'},
  // s25_pitching (Stf+ × Loc+ combo) removed from mixed view
];

// 2026 Projected columns (same stats as main but without analytics clutter)
const batCols26 = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'age',label:'Age',w:40}, {key:'dp',label:'Pick',w:55,cls:'pnav-col'},
  {key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip},
  {key:'pa',label:'PA',w:50}, {key:'avg',label:'AVG',w:55}, {key:'obp',label:'OBP',w:55},
  {key:'slg',label:'SLG',w:55}, {key:'hr',label:'HR',w:45}, {key:'r',label:'R',w:45},
  {key:'rbi',label:'RBI',w:45}, {key:'sb',label:'SB',w:45}, {key:'so',label:'K',w:45}
];
const pitCols26 = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:50},
  {key:'age',label:'Age',w:40}, {key:'dp',label:'Pick',w:55,cls:'pnav-col'},
  {key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip},
  {key:'ip',label:'IP',w:50}, {key:'era',label:'ERA',w:55}, {key:'whip',label:'WHIP',w:60},
  {key:'so',label:'K',w:50}, {key:'w',label:'W',w:40}, {key:'sv',label:'SV',w:40},
  {key:'hld',label:'HD',w:40}, {key:'qs',label:'QS',w:40}, {key:'hr',label:'HRA',w:45}
];
// Unified All-tab columns for 2026: bat+pit stats in one row
const allCols26 = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'type',label:'Type',w:50}, {key:'age',label:'Age',w:40}, {key:'lcv',label:'LCV',w:55,cls:'lcv-col'}, {key:'tradeValue',label:'TV',w:55,tip:'Trade value: production + keeper premium + prospect value'},
  {key:'dp',label:'Pick',w:55,cls:'pnav-col'},
  {key:'trend',label:'Trend',w:55,cls:'pnav-col',tip:trendTip},
  {key:'pa',label:'PA',w:45}, {key:'avg',label:'AVG',w:50}, {key:'obp',label:'OBP',w:50},
  {key:'slg',label:'SLG',w:50}, {key:'r',label:'R',w:38}, {key:'rbi',label:'RBI',w:38},
  {key:'sb',label:'SB',w:38}, {key:'hr',label:'HR',w:38}, {key:'so',label:'K',w:38},
  {key:'ip',label:'IP',w:45}, {key:'era',label:'ERA',w:50}, {key:'whip',label:'WHIP',w:55},
  {key:'w',label:'W',w:38}, {key:'sv',label:'SV',w:38},
  {key:'hld',label:'HD',w:38}, {key:'qs',label:'QS',w:38}
];

// 2026 Actual stats columns (s26_ prefixed data)
const batCols26A = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'age',label:'Age',w:40}, {key:'lcv',label:'LCV',w:55,tip:'Projected LCV from pre-season projections'},
  {key:'actualLcv',label:'aLCV',w:60,cls:'lcv-col',tip:'Actual LCV: z-score sum from 2026 in-season stats (same scale as projected LCV)'},
  {key:'lcvDelta',label:'\u0394LCV',w:60,tip:'Actual LCV minus Projected LCV. Positive = outperforming projections, negative = underperforming'},
  {key:'recScore',label:'Rec',w:55,cls:'lcv-col',tip:'Recommendation score: 60% aLCV + 15% positional flexibility + 15% age + 10% projected LCV. Z-scored within type pool (batter vs pitcher, SP vs RP). Used on Roster/Trade/Waiver recs.'},
  {key:'hotCold14',label:'14d',w:50,tip:'Trend over the last 14 days of snapshots: HOT = LCV swing ≥ +2.5, COLD = ≤ -2.5'},
  {key:'rollingLcvDelta14',label:'\u039414d',w:55,tip:'14-day rolling LCV minus projected LCV. Sample-size regressed toward projection.'},
  {key:'s26_pa',label:'PA',w:50}, {key:'s26_avg',label:'AVG',w:55}, {key:'s26_obp',label:'OBP',w:55},
  {key:'s26_slg',label:'SLG',w:55}, {key:'s26_hr',label:'HR',w:45}, {key:'s26_r',label:'R',w:45},
  {key:'s26_rbi',label:'RBI',w:45}, {key:'s26_sb',label:'SB',w:45}, {key:'s26_so',label:'K',w:45},
  // Simplified 2026 batter view: removed s26_iso (derivable from SLG-AVG),
  // s26_woba/dWoba (xwOBA captures the underlying quality better). BABIP kept as
  // regression indicator; K%/BB% kept (useful rate stats for an -K league).
  {key:'s26_bb',label:'BB',w:45,tip:'2026 walks'},
  {key:'s26_kpct',label:'K%',w:48,tip:'2026 strikeout rate (K/PA). High = swing-and-miss; this league penalizes Ks'},
  {key:'s26_bbpct',label:'BB%',w:48,tip:'2026 walk rate (BB/PA). High = plate discipline'},
  {key:'s26_babip',label:'BABIP',w:55,tip:'2026 Batting Average on Balls in Play. Regression indicator: outliers tend to normalize'},
  {key:'s26_xwoba',label:'xwOBA',w:55,tip:'2026 xwOBA (Statcast expected). Better than wOBA for future-predictive signal'}, {key:'dXwoba',label:'\u0394xwOBA',w:58,tip:'2026 xwOBA minus 2025 xwOBA. Positive = underlying quality improving'},
  {key:'s26_barrel',label:'Brl%',w:50,tip:'2026 barrel rate (Statcast)'}, {key:'dBarrel',label:'\u0394Brl',w:50,tip:'2026 Brl% minus 2025 Brl%'},
  {key:'s26_hardhit',label:'HH%',w:50,tip:'2026 hard hit rate (95+ mph exit velo)'}, {key:'dHardhit',label:'\u0394HH',w:50,tip:'2026 HH% minus 2025 HH%'}
];
const pitCols26A = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:50},
  {key:'age',label:'Age',w:40}, {key:'lcv',label:'LCV',w:55,tip:'Projected LCV from pre-season projections'},
  {key:'actualLcv',label:'aLCV',w:60,cls:'lcv-col',tip:'Actual LCV: z-score sum from 2026 in-season stats (same scale as projected LCV)'},
  {key:'lcvDelta',label:'\u0394LCV',w:60,tip:'Actual LCV minus Projected LCV. Positive = outperforming projections, negative = underperforming'},
  {key:'recScore',label:'Rec',w:55,cls:'lcv-col',tip:'Recommendation score: 60% aLCV + 15% positional flexibility + 15% age + 10% projected LCV. Z-scored within type pool (SP vs RP). Used on Roster/Trade/Waiver recs.'},
  {key:'hotCold14',label:'14d',w:50,tip:'Trend over the last 14 days of snapshots: HOT = LCV swing ≥ +3.5, COLD = ≤ -3.0 (pitchers move faster)'},
  {key:'rollingLcvDelta14',label:'\u039414d',w:55,tip:'14-day rolling LCV minus projected LCV. Sample-size regressed toward projection.'},
  {key:'s26_ip',label:'IP',w:50}, {key:'s26_era',label:'ERA',w:55}, {key:'s26_whip',label:'WHIP',w:60},
  {key:'s26_fip',label:'FIP',w:50,tip:'2026 FIP = (13×HR + 3×(BB+HBP) − 2×K) / IP + 3.10. ERA estimator that strips luck'},
  {key:'s26_so',label:'K',w:50}, {key:'s26_w',label:'W',w:40}, {key:'s26_sv',label:'SV',w:40},
  {key:'s26_hld',label:'HD',w:40}, {key:'s26_qs',label:'QS',w:40}, {key:'s26_hr',label:'HRA',w:45},
  // Simplified 2026 pitcher view: removed s26_hr9 (derivable from HRA/IP),
  // s26_pitching/dPitching (combo of Stuff+ and Loc+ — keep the components).
  // FIP retained as a luck-free ERA estimator.
  {key:'s26_bb',label:'BB',w:45,tip:'2026 walks allowed'},
  {key:'s26_kpct',label:'K%',w:48,tip:'2026 strikeout rate (K/BF). 25%+ is above average'},
  {key:'s26_bbpct',label:'BB%',w:48,tip:'2026 walk rate (BB/BF). Sub-8% is good control'},
  {key:'s26_stuff',label:'Stf+',w:50,tip:'2026 Stuff+ (pitch quality, 100=avg)'}, {key:'dStuff',label:'\u0394Stf',w:50,tip:'2026 Stuff+ minus 2025. Positive = stuff improving'},
  {key:'s26_loc',label:'Loc+',w:50,tip:'2026 Location+ (command, 100=avg)'}, {key:'dLoc',label:'\u0394Loc',w:50,tip:'2026 Loc+ minus 2025. Positive = command improving'}
];
// Mixed bat+pit view — shows advanced metrics alongside core stats.
// Batting cells are blank for pitchers and vice versa.
const allCols26A = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'type',label:'Type',w:50}, {key:'age',label:'Age',w:40},
  {key:'lcv',label:'LCV',w:55,cls:'lcv-col',tip:'Projected LCV'},
  {key:'actualLcv',label:'aLCV',w:60,cls:'lcv-col',tip:'Actual LCV from 2026 in-season stats'},
  {key:'lcvDelta',label:'\u0394LCV',w:60,tip:'Actual minus Projected LCV. Positive = outperforming'},
  {key:'recScore',label:'Rec',w:55,cls:'lcv-col',tip:'Recommendation score: 60% aLCV + 15% posFlex + 15% age + 10% LCV (z-scored within type pool). Drives Roster/Trade/Waiver recs.'},
  {key:'hotCold14',label:'14d',w:50,tip:'Rolling HOT/COLD over the last 14 snapshots'},
  {key:'rollingLcvDelta14',label:'\u039414d',w:55,tip:'14-day rolling ΔLCV (sample-size regressed)'},
  // Batting core (blank for pitchers)
  {key:'s26_pa',label:'PA',w:45}, {key:'s26_avg',label:'AVG',w:50},
  {key:'s26_hr',label:'HR',w:38}, {key:'s26_r',label:'R',w:38}, {key:'s26_sb',label:'SB',w:38},
  // Pitching core (blank for batters)
  {key:'s26_ip',label:'IP',w:45}, {key:'s26_era',label:'ERA',w:50},
  {key:'s26_whip',label:'WHIP',w:55}, {key:'s26_so',label:'K',w:38}, {key:'s26_sv',label:'SV',w:38},
  {key:'s26_qs',label:'QS',w:38},
  // Advanced batter metrics
  {key:'s26_kpct',label:'K%',w:48,tip:'2026 K rate (batters)'},
  {key:'s26_xwoba',label:'xwOBA',w:55,tip:'2026 xwOBA (Statcast expected)'},
  {key:'s26_barrel',label:'Brl%',w:50,tip:'2026 barrel rate'},
  {key:'s26_hardhit',label:'HH%',w:50,tip:'2026 hard-hit rate'},
  // Advanced pitcher metrics
  {key:'s26_fip',label:'FIP',w:50,tip:'2026 FIP (luck-free ERA estimator)'},
  {key:'s26_stuff',label:'Stf+',w:50,tip:'2026 Stuff+ (pitch quality, 100=avg)'},
  {key:'s26_loc',label:'Loc+',w:50,tip:'2026 Location+ (command, 100=avg)'}
];

// Actual vs Projected comparison columns (side by side: proj then actual then delta)
const batColsAVP = [
  {key:'name',label:'Player',w:150}, {key:'pos',label:'Pos',w:50},
  {key:'lcv',label:'LCV',w:50},
  {key:'pa',label:'pPA',w:45,tip:'Projected PA'}, {key:'s26_pa',label:'aPA',w:45,tip:'Actual PA'},
  {key:'avg',label:'pAVG',w:52,tip:'Projected AVG'}, {key:'s26_avg',label:'aAVG',w:52,tip:'Actual AVG'},
  {key:'obp',label:'pOBP',w:52,tip:'Projected OBP'}, {key:'s26_obp',label:'aOBP',w:52,tip:'Actual OBP'},
  {key:'slg',label:'pSLG',w:52,tip:'Projected SLG'}, {key:'s26_slg',label:'aSLG',w:52,tip:'Actual SLG'},
  {key:'hr',label:'pHR',w:40,tip:'Projected HR'}, {key:'s26_hr',label:'aHR',w:40,tip:'Actual HR'},
  {key:'r',label:'pR',w:38,tip:'Projected R'}, {key:'s26_r',label:'aR',w:38,tip:'Actual R'},
  {key:'rbi',label:'pRBI',w:40,tip:'Projected RBI'}, {key:'s26_rbi',label:'aRBI',w:40,tip:'Actual RBI'},
  {key:'sb',label:'pSB',w:38,tip:'Projected SB'}, {key:'s26_sb',label:'aSB',w:38,tip:'Actual SB'}
];
const pitColsAVP = [
  {key:'name',label:'Player',w:150}, {key:'pos',label:'Pos',w:50},
  {key:'lcv',label:'LCV',w:50},
  {key:'ip',label:'pIP',w:45,tip:'Projected IP'}, {key:'s26_ip',label:'aIP',w:45,tip:'Actual IP'},
  {key:'era',label:'pERA',w:50,tip:'Projected ERA'}, {key:'s26_era',label:'aERA',w:50,tip:'Actual ERA'},
  {key:'whip',label:'pWHIP',w:55,tip:'Projected WHIP'}, {key:'s26_whip',label:'aWHIP',w:55,tip:'Actual WHIP'},
  {key:'so',label:'pK',w:40,tip:'Projected K'}, {key:'s26_so',label:'aK',w:40,tip:'Actual K'},
  {key:'w',label:'pW',w:38,tip:'Projected W'}, {key:'s26_w',label:'aW',w:38,tip:'Actual W'},
  {key:'sv',label:'pSV',w:38,tip:'Projected SV'}, {key:'s26_sv',label:'aSV',w:38,tip:'Actual SV'},
  {key:'hld',label:'pHD',w:38,tip:'Projected HD'}, {key:'s26_hld',label:'aHD',w:38,tip:'Actual HD'},
  {key:'qs',label:'pQS',w:38,tip:'Projected QS'}, {key:'s26_qs',label:'aQS',w:38,tip:'Actual QS'}
];
const allColsAVP = [
  {key:'name',label:'Player',w:150}, {key:'pos',label:'Pos',w:50},
  {key:'type',label:'Type',w:45}, {key:'lcv',label:'LCV',w:50,cls:'lcv-col'}, {key:'tradeValue',label:'TV',w:55,tip:'Trade value: production + keeper premium + prospect value'},
  {key:'avg',label:'pAVG',w:48,tip:'Projected'}, {key:'s26_avg',label:'aAVG',w:48,tip:'Actual'},
  {key:'hr',label:'pHR',w:38,tip:'Projected'}, {key:'s26_hr',label:'aHR',w:38,tip:'Actual'},
  {key:'r',label:'pR',w:36,tip:'Projected'}, {key:'s26_r',label:'aR',w:36,tip:'Actual'},
  {key:'rbi',label:'pRBI',w:38,tip:'Projected'}, {key:'s26_rbi',label:'aRBI',w:38,tip:'Actual'},
  {key:'sb',label:'pSB',w:36,tip:'Projected'}, {key:'s26_sb',label:'aSB',w:36,tip:'Actual'},
  {key:'era',label:'pERA',w:48,tip:'Projected'}, {key:'s26_era',label:'aERA',w:48,tip:'Actual'},
  {key:'whip',label:'pWHIP',w:52,tip:'Projected'}, {key:'s26_whip',label:'aWHIP',w:52,tip:'Actual'},
  {key:'sv',label:'pSV',w:36,tip:'Projected'}, {key:'s26_sv',label:'aSV',w:36,tip:'Actual'}
];

// Main (analytics) columns
const batCols = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'war',label:'WAR',w:50},
  {key:'dp',label:'Pick',w:60,cls:'pnav-col',tip:'Draft Priority = 0.4×LCV + 0.6×PNAV. Single metric combining raw value with positional need. Higher = pick this player. Updates in real-time as you draft.'},
  {key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value = sum of z-scores across all 8 batting categories your league uses: z(AVG) + z(HR) + z(OBP) + z(SLG) + z(R) + z(RBI) + z(SB) − z(K). Higher = more valuable to your league.'},
  {key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'UPSIDE = LCV × Age Factor. Raw value weighted by age — young players (≤24) get up to 35%% boost; older players (32+) get penalized. Position-agnostic long-term ceiling.'},
  {key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip},
  {key:'s25_barrel',label:'Brl%',w:50}, {key:'s25_hardhit',label:'HH%',w:50},
  {key:'s25_woba',label:'wOBA',w:55}, {key:'s25_xwoba',label:'xwOBA',w:55},
  {key:'s25_delta',label:'xw\u0394',w:50,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'},
  {key:'pa',label:'PA',w:50}, {key:'avg',label:'AVG',w:55}, {key:'obp',label:'OBP',w:55},
  {key:'slg',label:'SLG',w:55}, {key:'hr',label:'HR',w:45}, {key:'r',label:'R',w:45},
  {key:'rbi',label:'RBI',w:45}, {key:'sb',label:'SB',w:45}, {key:'so',label:'K',w:45}
];
const pitCols = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:50},
  {key:'war',label:'WAR',w:50},
  {key:'dp',label:'Pick',w:60,cls:'pnav-col',tip:'Draft Priority = 0.4×LCV + 0.6×PNAV. Single metric combining raw value with positional need. Higher = pick this player. Updates in real-time as you draft.'},
  {key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value = sum of z-scores across all 8 pitching categories: −z(ERA) + z(HD) − z(HRA) + z(K) + z(SV) + z(W) − z(WHIP) + z(QS). Higher = more valuable.'},
  {key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'UPSIDE = LCV × Age Factor. Raw value weighted by age — young players (≤24) get up to 35%% boost; older players (32+) get penalized. Position-agnostic long-term ceiling.'},
  {key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip},
  {key:'s25_stuff',label:'Stf+',w:50,tip:'Stuff+ measures pitch quality based on movement/velo. 100=avg'},
  {key:'s25_loc',label:'Loc+',w:50,tip:'Location+ measures command/control. 100=avg'},
  // s25_pitching (Stf+ × Loc+ combo) removed — components shown instead,
  {key:'ip',label:'IP',w:50}, {key:'era',label:'ERA',w:55}, {key:'whip',label:'WHIP',w:60},
  {key:'so',label:'K',w:50}, {key:'w',label:'W',w:40}, {key:'sv',label:'SV',w:40},
  {key:'hld',label:'HD',w:40}, {key:'qs',label:'QS',w:40}, {key:'hr',label:'HRA',w:45}
];
const allCols = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'type',label:'Type',w:50}, {key:'age',label:'Age',w:40},
  {key:'war',label:'WAR',w:50},
  {key:'dp',label:'Pick',w:60,cls:'pnav-col',tip:'Draft Priority = 0.4×LCV + 0.6×PNAV. The single "who should I pick" metric. Higher = pick this player first. Updates in real-time as you draft.'},
  {key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value — z-score sum across all counted league categories (8 batting or 8 pitching). Higher = more valuable to your league scoring.'},
  {key:'tradeValue',label:'TV',w:55,tip:'Trade value: production + keeper premium + prospect value'},
  {key:'pnav',label:'PNAV',w:65,cls:'pnav-col',tip:'Positional Need-Adjusted Value = LCV × Position Multiplier × Scarcity Factor. Updates dynamically as you draft players and your positional needs change.'},
  {key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'UPSIDE = LCV × Age Factor. Raw value weighted by age — young players get boosted, older players penalized. Position-agnostic long-term ceiling.'},
  {key:'trend',label:'Trend',w:60,cls:'pnav-col',tip:trendTip},
  {key:'s25_barrel',label:'Brl%',w:48,tip:'Barrel rate: optimal launch angle + exit velo'}, {key:'s25_hardhit',label:'HH%',w:48,tip:'Hard hit rate: 95+ mph exit velocity'},
  {key:'s25_woba',label:'wOBA',w:50,tip:'Weighted On-Base Average'}, {key:'s25_xwoba',label:'xwOBA',w:52,tip:'Expected wOBA (Statcast)'},
  {key:'s25_delta',label:'xw\u0394',w:48,tip:'xwOBA minus wOBA. Positive = underperforming (unlucky), negative = overperforming (lucky)'},
  {key:'s25_stuff',label:'Stf+',w:48,tip:'Stuff+ measures pitch quality. 100=avg'},
  {key:'s25_loc',label:'Loc+',w:48,tip:'Location+. 100=avg'},
  // s25_pitching (Stf+ × Loc+ combo) removed from mixed view
];

// GM View columns
const batColsGM = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'age',label:'Age',w:40},
  {key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value: sum of z-scores across 8 league categories'},
  {key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'Upside score based on percentile ceiling and statcast metrics'},
  {key:'keeperRound',label:'Keeper Rd',w:70,tip:'Round player was drafted. R1-4 cannot be kept.'},
  {key:'keeperCost2027',label:'2027 Cost',w:70,tip:'Draft round cost to keep this player in 2027 (advances 4 rounds/year)'},
  {key:'yearsControl',label:'Yrs Ctrl',w:60,tip:'Years of keeper eligibility remaining before reaching R1-4'},
  {key:'surplusNow',label:'Surplus',w:65,tip:'Current surplus: LCV minus round value of keeper cost'},
  {key:'multiYearSurplus',label:'MYS',w:60,tip:'Multi-Year Surplus: discounted sum of future keeper surplus values'},
  {key:'prospectValue',label:'Prospect',w:65,tip:'Prospect value based on FV grade from scouting reports'},
  {key:'tradeValue',label:'Trade Val',w:70,tip:'Trade value: production + keeper premium (if surplus justifies slot) + prospect value'}
];

const pitColsGM = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'age',label:'Age',w:40},
  {key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value: sum of z-scores across 8 league categories'},
  {key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'Upside score based on percentile ceiling and statcast metrics'},
  {key:'keeperRound',label:'Keeper Rd',w:70,tip:'Round player was drafted. R1-4 cannot be kept.'},
  {key:'keeperCost2027',label:'2027 Cost',w:70,tip:'Draft round cost to keep this player in 2027 (advances 4 rounds/year)'},
  {key:'yearsControl',label:'Yrs Ctrl',w:60,tip:'Years of keeper eligibility remaining before reaching R1-4'},
  {key:'surplusNow',label:'Surplus',w:65,tip:'Current surplus: LCV minus round value of keeper cost'},
  {key:'multiYearSurplus',label:'MYS',w:60,tip:'Multi-Year Surplus: discounted sum of future keeper surplus values'},
  {key:'prospectValue',label:'Prospect',w:65,tip:'Prospect value based on FV grade from scouting reports'},
  {key:'tradeValue',label:'Trade Val',w:70,tip:'Trade value: production + keeper premium (if surplus justifies slot) + prospect value'}
];

const allColsGM = [
  {key:'name',label:'Player',w:160}, {key:'team',label:'Team',w:50}, {key:'pos',label:'Pos',w:60},
  {key:'type',label:'Type',w:50},
  {key:'age',label:'Age',w:40},
  {key:'lcv',label:'LCV',w:60,cls:'lcv-col',tip:'League Category Value: sum of z-scores across 8 league categories'},
  {key:'upside',label:'Upside',w:65,cls:'pnav-col',tip:'Upside score based on percentile ceiling and statcast metrics'},
  {key:'keeperRound',label:'Keeper Rd',w:70,tip:'Round player was drafted. R1-4 cannot be kept.'},
  {key:'keeperCost2027',label:'2027 Cost',w:70,tip:'Draft round cost to keep this player in 2027 (advances 4 rounds/year)'},
  {key:'yearsControl',label:'Yrs Ctrl',w:60,tip:'Years of keeper eligibility remaining before reaching R1-4'},
  {key:'surplusNow',label:'Surplus',w:65,tip:'Current surplus: LCV minus round value of keeper cost'},
  {key:'multiYearSurplus',label:'MYS',w:60,tip:'Multi-Year Surplus: discounted sum of future keeper surplus values'},
  {key:'prospectValue',label:'Prospect',w:65,tip:'Prospect value based on FV grade from scouting reports'},
  {key:'tradeValue',label:'Trade Val',w:70,tip:'Trade value: production + keeper premium (if surplus justifies slot) + prospect value'}
];

// Positions that imply a batter-only or pitcher-only view when filterType==='all'
const BAT_POSITIONS = new Set(['C','1B','2B','3B','SS','LF','CF','RF','OF','DH','MI','CI','UTIL']);
const PIT_POSITIONS = new Set(['SP','RP']);

// When filterType is 'all' but a position filter is active, infer bat/pit
function _inferType() {
  const pos = (DPF.table && DPF.table.filterPos) || 'ALL';
  if (BAT_POSITIONS.has(pos)) return 'bat';
  if (PIT_POSITIONS.has(pos)) return 'pit';
  return DPF.ui.filterType || 'all';
}

function getCols() {
  const ft = DPF.ui.filterType === 'all' ? _inferType() : DPF.ui.filterType;

  if (DPF.ui.currentView === 'gm') {
    if (ft === 'bat') return batColsGM;
    if (ft === 'pit') return pitColsGM;
    return allColsGM;
  }
  if (DPF.ui.currentView === 's25') {
    if (ft === 'bat') return batCols25;
    if (ft === 'pit') return pitCols25;
    return allCols25;
  }
  if (DPF.ui.currentView === 'p26') {
    if (ft === 'bat') return batCols26;
    if (ft === 'pit') return pitCols26;
    return allCols26;
  }
  if (DPF.ui.currentView === 's26') {
    if (ft === 'bat') return batCols26A;
    if (ft === 'pit') return pitCols26A;
    return allCols26A;
  }
  if (DPF.ui.currentView === 'avp') {
    if (ft === 'bat') return batColsAVP;
    if (ft === 'pit') return pitColsAVP;
    return allColsAVP;
  }
  // main/analytics view
  if (ft === 'bat') return batCols;
  if (ft === 'pit') return pitCols;
  return allCols;
}

