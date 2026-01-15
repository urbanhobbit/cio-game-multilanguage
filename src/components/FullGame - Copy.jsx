import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import config from "../data/config.json";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// --- VERİ DOSYALARININ İÇE AKTARILMASI ---
import parentScenariosTr from "../data/scenarios_parent_tr.json";
import parentScenariosEn from "../data/scenarios_parent_en.json";
import childScenariosTr from "../data/scenarios_child_tr.json";
import childScenariosEn from "../data/scenarios_child_en.json";

const initialSettings = config.initial_settings;
const balance = config.game_balance;

const cloneMetrics = () => ({ ...initialSettings.metrics });

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));

// --- MOBİL KONTROL HOOK'U ---
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
}

export default function FullGame() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState("adult");
  const [isDark, setIsDark] = useState(true); // TEMA DURUMU
  const isKids = mode === "kids";
  const isMobile = useIsMobile(); 

  // --- DİNAMİK VERİ SEÇİMİ ---
  const scenariosData = useMemo(() => {
    const lang = i18n.language;
    if (isKids) {
      return lang === "en" ? childScenariosEn : childScenariosTr;
    } else {
      return lang === "en" ? parentScenariosEn : parentScenariosTr;
    }
  }, [isKids, i18n.language]);

  const allScenarioIds = useMemo(
    () => Object.keys(scenariosData),
    [scenariosData]
  );

  const [screen, setScreen] = useState("start");
  const [metrics, setMetrics] = useState(cloneMetrics);
  const [budget, setBudget] = useState(initialSettings.budget);
  const [hr, setHr] = useState(initialSettings.hr);
  const [crisisSequence, setCrisisSequence] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [news, setNews] = useState([]);
  const [history, setHistory] = useState([cloneMetrics()]);
  const [decision, setDecision] = useState({});
  const [results, setResults] = useState(null);
  const [metricsBefore, setMetricsBefore] = useState(cloneMetrics);
  const [selectedIds, setSelectedIds] = useState(new Set(allScenarioIds));

  const leftColRef = useRef(null);
  const topRef = useRef(null); 

  const currentScenario =
    selectedScenarioId != null ? scenariosData[selectedScenarioId] : null;

  const maxCrises = 4;

  // Stilleri Dinamik Al (Mobil ve Dark Mode'a göre)
  const currentStyles = useMemo(() => getStyles(isMobile, isDark), [isMobile, isDark]);

  const addNews = (headline) => {
    setNews((prev) => {
      const next = [headline, ...prev];
      return next.slice(0, 10); 
    });
  };

  const resetGame = () => {
    setScreen("start");
    setMetrics(cloneMetrics());
    setBudget(initialSettings.budget);
    setHr(initialSettings.hr);
    setCrisisSequence([]);
    setCurrentIndex(0);
    setSelectedScenarioId(null);
    setNews([t('start_screen.welcome_' + (isKids ? 'kids' : 'adult'))]);
    setHistory([cloneMetrics()]);
    setDecision({});
    setResults(null);
    const freshIds = new Set(Object.keys(scenariosData));
    setSelectedIds(freshIds);
  };

  useEffect(() => {
    resetGame();
  }, [mode, scenariosData, isKids, i18n.language]);

  useEffect(() => {
    if (isMobile && topRef.current) {
        topRef.current.scrollIntoView({ behavior: "smooth" });
    } else if(leftColRef.current) {
        leftColRef.current.scrollTop = 0;
    }
  }, [screen, isMobile]);

  const startGame = (withTutorial = false) => {
    const ids =
      selectedIds.size > 0 ? Array.from(selectedIds) : [...allScenarioIds];
    const seq = shuffle(ids).slice(0, maxCrises);
    if (!seq.length) return;

    setCrisisSequence(seq);
    setCurrentIndex(0);
    setSelectedScenarioId(seq[0]);
    setHistory([cloneMetrics()]);
    setScreen(withTutorial ? "tutorial" : "story");
  };

  const calculateEffects = (action, scope, duration, safeguards) => {
    // ... (Hesaplama mantığı aynı) ...
    const THREAT_SEVERITY = balance.THREAT_SEVERITY;
    const RANDOM_FACTOR_RANGE = balance.RANDOM_FACTOR_RANGE;
    const SCOPE_MULTIPLIERS = balance.SCOPE_MULTIPLIERS;
    const DURATION_MULTIPLIERS = balance.DURATION_MULTIPLIERS;
    const SAFEGUARD_QUALITY_PER_ITEM = balance.SAFEGUARD_QUALITY_PER_ITEM;
    const TRUST_BOOST_FOR_TRANSPARENCY = balance.TRUST_BOOST_FOR_TRANSPARENCY;
    const FATIGUE_PER_DURATION = balance.FATIGUE_PER_DURATION;

    const randomFactor =
      Math.random() *
        (RANDOM_FACTOR_RANGE[1] - RANDOM_FACTOR_RANGE[0]) +
      RANDOM_FACTOR_RANGE[0];

    const scopeMultiplier = SCOPE_MULTIPLIERS[scope];
    const durationMultiplier = DURATION_MULTIPLIERS[duration];
    const safeguardQuality =
      (safeguards?.length || 0) * SAFEGUARD_QUALITY_PER_ITEM;

    let securityChange =
      (THREAT_SEVERITY * action.security_effect) / 100 -
      action.side_effect_risk * randomFactor * 20;

    let freedomCost =
      action.freedom_cost *
      scopeMultiplier *
      durationMultiplier *
      (1 - safeguardQuality * action.safeguard_reduction);

    let publicTrustChange =
      (safeguards?.includes("transparency")
        ? TRUST_BOOST_FOR_TRANSPARENCY
        : 0) - freedomCost * 0.5;

    let resilienceChange =
      action.speed === "slow"
        ? (action.security_effect * safeguardQuality) / 2
        : 5;

    let fatigueChange =
      DURATION_MULTIPLIERS[duration] * FATIGUE_PER_DURATION[scope];

    const counter_factual =
      action.id === "A"
        ? 'counter_factual_A'
        : 'counter_factual_other';

    const nextMetrics = {
      security: clamp(metrics.security + securityChange),
      freedom: clamp(metrics.freedom - freedomCost),
      public_trust: clamp(metrics.public_trust + publicTrustChange),
      resilience: clamp(metrics.resilience + resilienceChange),
      fatigue: clamp(metrics.fatigue + fatigueChange),
    };

    const nextBudget = budget - action.cost;
    const nextHr = hr - action.hr_cost;

    return {
      metrics: nextMetrics,
      budget: nextBudget,
      hr: nextHr,
      counter_factual,
    };
  };

  const calculateSkipTurnEffects = () => {
    const securityPenalty = -25;
    const trustPenalty = -20;
    const resiliencePenalty = -10;
    const fatigueIncrease = 15;

    const nextMetrics = {
      security: clamp(metrics.security + securityPenalty),
      freedom: metrics.freedom,
      public_trust: clamp(metrics.public_trust + trustPenalty),
      resilience: clamp(metrics.resilience + resiliencePenalty),
      fatigue: clamp(metrics.fatigue + fatigueIncrease),
    };

    return {
      metrics: nextMetrics,
      budget,
      hr,
      counter_factual: 'skip_reason',
    };
  };

  // START SCREEN LAYOUT
  if (screen === "start") {
    return (
      <div style={currentStyles.wrapper}>
        <div style={currentStyles.gameContainer}>
           <HeaderSimple isKids={isKids} onRestart={resetGame} styles={currentStyles} isDark={isDark} setIsDark={setIsDark} />
           <div style={{ padding: isMobile ? 15 : 20, overflowY: 'auto', height: '100%' }}>
             <StartScreen
               allScenarioIds={allScenarioIds}
               selectedIds={selectedIds}
               setSelectedIds={setSelectedIds}
               onStart={() => startGame(false)}
               onStartTutorial={() => startGame(true)}
               mode={mode}
               setMode={setMode}
               isKids={isKids}
               scenariosData={scenariosData}
               styles={currentStyles}
             />
           </div>
        </div>
      </div>
    );
  }

  if (!currentScenario) {
    return (
      <div style={currentStyles.wrapper}>
         <div style={currentStyles.gameContainer}>
            <p style={{padding: 20, color: currentStyles.textColor}}>Scenario not found.</p>
            <button style={currentStyles.primaryButton} onClick={resetGame}>{t('common.restart')}</button>
         </div>
      </div>
    );
  }

  const goNextCrisisOrEnd = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < crisisSequence.length) {
      const nextId = crisisSequence[nextIndex];
      setCurrentIndex(nextIndex);
      setSelectedScenarioId(nextId);
      setScreen("story");
      setHistory((h) => [...h, { ...metrics }]);
      setDecision({});
      setResults(null);
    } else {
      setScreen("end");
    }
  };

  return (
    <div style={currentStyles.wrapper} ref={topRef}>
      <div style={currentStyles.gameContainer}>
        <HeaderWithStatus
          scenario={currentScenario}
          index={currentIndex}
          total={crisisSequence.length}
          isKids={isKids}
          onRestart={resetGame}
          styles={currentStyles}
          isDark={isDark}
          setIsDark={setIsDark}
        />

        <div style={currentStyles.mainContentGrid}>
          <div style={currentStyles.leftColumn} ref={leftColRef}>
            {screen === "tutorial" && (
              <TutorialScreen onNext={() => setScreen("story")} isKids={isKids} styles={currentStyles} isDark={isDark} />
            )}

            {screen === "story" && (
              <StoryScreen
                scenario={currentScenario}
                onNext={() => setScreen("advisors")}
                isKids={isKids}
                styles={currentStyles}
              />
            )}

            {screen === "advisors" && (
              <AdvisorsScreen
                scenario={currentScenario}
                onNext={() => setScreen("decision")}
                isKids={isKids}
                styles={currentStyles}
              />
            )}

            {screen === "decision" && (
              <DecisionScreen
                scenario={currentScenario}
                budget={budget}
                hr={hr}
                onSkip={() => {
                  setMetricsBefore({ ...metrics });
                  const res = calculateSkipTurnEffects();
                  setResults(res);
                  setMetrics(res.metrics);
                  setBudget(res.budget);
                  setHr(res.hr);
                  setDecision({ skipped: true });
                  setScreen("immediate");
                }}
                onApply={(opts) => {
                  const { action, scope, duration, safeguards } = opts;
                  setMetricsBefore({ ...metrics });
                  const res = calculateEffects(action, scope, duration, safeguards);
                  setResults({ ...res, actionId: action.id, actionName: action.name, scope, duration, safeguards, skipped: false });
                  setMetrics(res.metrics);
                  setBudget(res.budget);
                  setHr(res.hr);
                  setDecision({ actionId: action.id, scope, duration, safeguards, skipped: false });
                  setScreen("immediate");
                }}
                isKids={isKids}
                scrollRef={leftColRef}
                styles={currentStyles}
                isMobile={isMobile}
              />
            )}

            {screen === "immediate" && results && (
              <ImmediateScreen
                scenario={currentScenario}
                results={results}
                metricsBefore={metricsBefore}
                metricsAfter={metrics}
                onNext={() => setScreen("delayed")}
                isKids={isKids}
                styles={currentStyles}
              />
            )}

            {screen === "delayed" && results && (
              <DelayedScreen
                scenario={currentScenario}
                results={results}
                isKids={isKids}
                onNext={() => setScreen("report")}
                styles={currentStyles}
              />
            )}

            {screen === "report" && results && (
              <ReportScreen
                metricsBefore={history[currentIndex]}
                metricsAfter={metrics}
                results={results}
                onNext={goNextCrisisOrEnd}
                isKids={isKids}
                styles={currentStyles}
                isDark={isDark}
              />
            )}

            {screen === "end" && (
              <EndScreen
                metrics={metrics}
                budget={budget}
                hr={hr}
                history={history}
                onRestart={resetGame}
                isKids={isKids}
                styles={currentStyles}
                isDark={isDark}
              />
            )}
          </div>

          <div style={currentStyles.rightColumn}>
            <div style={{...currentStyles.panelBox, flex: 1}}>
               <MetricsPanel metrics={metrics} budget={budget} hr={hr} isKids={isKids} styles={currentStyles} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Components ---

function HeaderSimple({ isKids = false, onRestart, styles, isDark, setIsDark }) {
  const { t, i18n } = useTranslation();
  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr');
  };
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.headerIcon}>🛡️</span>
        <div>
          <div style={styles.headerTitle}>{t(isKids ? 'header.title_kids' : 'header.title_adult')}</div>
          <div style={styles.headerSubtitle}>{t(isKids ? 'header.subtitle_kids' : 'header.subtitle_adult')}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* TEMA BUTONU */}
        <button onClick={() => setIsDark(!isDark)} style={styles.langButton}>
            {isDark ? '☀️' : '🌙'}
        </button>
        <button onClick={toggleLang} style={styles.langButton}>{i18n.language === 'tr' ? 'EN' : 'TR'}</button>
        {onRestart && (
          <button type="button" onClick={onRestart} style={styles.headerRestartButton}>
            {t('header.restart_button')}
          </button>
        )}
      </div>
    </div>
  );
}

function HeaderWithStatus({ scenario, index, total, isKids = false, onRestart, styles, isDark, setIsDark }) {
  const { t, i18n } = useTranslation();
  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr');
  };
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.headerIcon}>{scenario.icon || "📁"}</span>
        <div>
          <div style={styles.headerTitle}>{scenario.title}</div>
          <div style={styles.headerSubtitle}>
             {isKids ? `${t('common.mission')} ${index + 1} / ${total}` : `Kriz ${index + 1} / ${total}`}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* TEMA BUTONU */}
        <button onClick={() => setIsDark(!isDark)} style={styles.langButton}>
            {isDark ? '☀️' : '🌙'}
        </button>
        <button onClick={toggleLang} style={styles.langButton}>{i18n.language === 'tr' ? 'EN' : 'TR'}</button>
        <div style={styles.headerBadge}>{t(isKids ? 'header.badge_kids' : 'header.badge_adult')}</div>
        {onRestart && (
          <button type="button" onClick={onRestart} style={styles.headerRestartButton}>
            ↺
          </button>
        )}
      </div>
    </div>
  );
}

function StartScreen({ allScenarioIds, selectedIds, setSelectedIds, onStart, onStartTutorial, mode, setMode, isKids, scenariosData, styles }) {
  const { t } = useTranslation();
  const toggleId = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <div>
        <h2 style={{...styles.phaseTitle, fontSize: 24, marginBottom: 4, color: styles.accentColor}}>{t(isKids ? 'start_screen.welcome_kids' : 'start_screen.welcome_adult')}</h2>
        <p style={styles.storyText}>{t(isKids ? 'start_screen.intro_text_kids' : 'start_screen.intro_text_adult')}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: '10px 0', borderTop: styles.border, borderBottom: styles.border }}>
        <span style={{ fontSize: 13, color: styles.subTextColor, fontWeight: '600' }}>{t('start_screen.profile_select')}</span>
        <Chip label={t('start_screen.profile_adult')} active={mode === "adult"} onClick={() => setMode("adult")} styles={styles}/>
        <Chip label={t('start_screen.profile_kids')} active={mode === "kids"} onClick={() => setMode("kids")} styles={styles}/>
      </div>

      <div>
        <h3 style={{...styles.sideTitle, fontSize: 15}}>{t(isKids ? 'start_screen.scenarios_title_kids' : 'start_screen.scenarios_title_adult')}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allScenarioIds.map((id) => (
            <label key={id} style={{ 
                borderRadius: 8, 
                border: selectedIds.has(id) ? `1px solid ${styles.accentColor}` : styles.border, 
                padding: "8px 12px", 
                fontSize: 13, 
                cursor: "pointer", 
                background: selectedIds.has(id) ? styles.selectedBg : styles.cardBg,
                color: selectedIds.has(id) ? styles.accentColor : styles.subTextColor,
                transition: "all 0.2s",
                display: 'flex', alignItems: 'center', gap: 6
            }}>
              <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleId(id)} style={{ marginRight: 0 }} />
              <span>{scenariosData[id].icon} {scenariosData[id].title}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ ...styles.actionsRow, gap: 12, justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
        <button style={styles.primaryButton} onClick={onStartTutorial}>
           🎓 {t('start_screen.btn_tutorial')}
        </button>
        <button 
          style={{ 
            ...styles.primaryButton, 
            background: "linear-gradient(to right, #3b82f6, #2563eb)",
            boxShadow: "0 0 15px rgba(59, 130, 246, 0.4)",
            color: "white" 
          }} 
          onClick={onStart}
        >
          ⚡ {t('start_screen.btn_start')}
        </button>
      </div>
    </div>
  );
}

function TutorialScreen({ onNext, isKids = false, styles, isDark }) {
  const { t } = useTranslation();
  const [demoMetrics, setDemoMetrics] = useState({
    security: 50,
    freedom: 50,
    public_trust: 50
  });

  const handleDemoClick = (type) => {
    setDemoMetrics(prev => {
      if (type === 'security') {
        return {
          security: Math.min(100, prev.security + 20),
          freedom: Math.max(0, prev.freedom - 15),
          public_trust: Math.max(0, prev.public_trust - 5)
        };
      } else {
        return {
          security: Math.max(0, prev.security - 10),
          freedom: Math.min(100, prev.freedom + 20),
          public_trust: Math.min(100, prev.public_trust + 10)
        };
      }
    });
  };

  return (
    <div>
      <h2 style={styles.phaseTitle}>{t('tutorial.title')}</h2>
      <p style={styles.storyText}>{t(isKids ? 'tutorial.desc_kids' : 'tutorial.desc_adult')}</p>
      
      <div style={{
          marginTop: 20, 
          marginBottom: 20, 
          padding: 15, 
          background: styles.cardBg, 
          borderRadius: 12, 
          border: styles.border
      }}>
        <h4 style={{...styles.panelTitle, marginBottom: 10}}>
          {isKids ? "Deneme Yap:" : "Simulation Test:"}
        </h4>
        
        <div style={{display: 'flex', gap: 10, marginBottom: 15}}>
          <button 
            onClick={() => handleDemoClick('security')}
            style={{...styles.primaryButton, background: '#3b82f6', fontSize: 12, padding: '8px 12px'}}>
            🛡️ +{t('metrics.security')}
          </button>
          <button 
            onClick={() => handleDemoClick('freedom')}
            style={{...styles.primaryButton, background: '#10b981', fontSize: 12, padding: '8px 12px'}}>
            🗽 +{t('metrics.freedom')}
          </button>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
           <TutorialMetric label={t('metrics.security')} value={demoMetrics.security} color="#38bdf8" isDark={isDark} />
           <TutorialMetric label={t('metrics.freedom')} value={demoMetrics.freedom} color="#a3e635" isDark={isDark} />
           <TutorialMetric label={t('metrics.public_trust')} value={demoMetrics.public_trust} color="#facc15" isDark={isDark} />
        </div>
        
        <p style={{fontSize: 11, color: styles.subTextColor, marginTop: 10, fontStyle: 'italic'}}>
          * {isKids ? "Butonlara basarak dengelerin nasıl değiştiğini gör." : "Click buttons to see how choices affect metrics."}
        </p>
      </div>

      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>{t('tutorial.btn_end')}</button>
      </div>
    </div>
  );
}

function TutorialMetric({ label, value, color, isDark }) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: isDark ? '#cbd5e1' : '#334155'}}>
      <div style={{width: 80}}>{label}</div>
      <div style={{flex: 1, height: 6, background: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 99}}>
        <div style={{
            width: `${value}%`, 
            height: '100%', 
            background: color, 
            borderRadius: 99,
            transition: 'width 0.3s ease'
        }}></div>
      </div>
      <div style={{width: 30, textAlign: 'right'}}>{value}</div>
    </div>
  );
}

function StoryScreen({ scenario, onNext, isKids = false, styles }) {
  const { t } = useTranslation();
  const marker = `**${t('common.mission')}**:`;
  
  const [reportPart, missionPart] = useMemo(() => {
    const idx = scenario.story.indexOf(marker);
    if (idx === -1) return [scenario.story, ""];
    return [
      scenario.story.slice(0, idx),
      scenario.story.slice(idx + marker.length),
    ];
  }, [scenario.story, marker]);

  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.story_title_kids' : 'phases.story_title_adult')}</h2>
      <p style={styles.storyText}>{reportPart}</p>
      
      {missionPart && (
        <div style={styles.missionBox}>
          <h3 style={styles.missionTitle}>{t('common.mission_yours')}</h3>
          <p style={styles.storyText}>{missionPart}</p>
          <div style={{marginTop: 16, display: 'flex', justifyContent: 'center'}}>
             <button style={styles.primaryButton} onClick={onNext}>
               {t('phases.btn_listen')}
             </button>
          </div>
        </div>
      )}
      
      {!missionPart && (
         <div style={styles.actionsRow}>
           <button style={styles.primaryButton} onClick={onNext}>{t('common.next')}</button>
         </div>
      )}
    </div>
  );
}

function AdvisorsScreen({ scenario, news, onNext, isKids = false, styles }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.advisors_title_kids' : 'phases.advisors_title_adult')}</h2>
      <div style={styles.advisorsGrid}>
        {scenario.advisors.map((a, i) => (
          <div key={i} style={styles.advisorCard}>
            <div style={styles.advisorName}>{a.name}</div>
            <div style={styles.advisorText}>{a.text}</div>
          </div>
        ))}
      </div>
      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>{t(isKids ? 'phases.advisors_btn_kids' : 'phases.advisors_btn_adult')}</button>
      </div>
    </div>
  );
}

function DecisionScreen({ scenario, budget, hr, onSkip, onApply, isKids = false, scrollRef, styles, isMobile }) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(null);
  const [scope, setScope] = useState("targeted");
  const [duration, setDuration] = useState("short");
  const [safeguards, setSafeguards] = useState(new Set());

  const affordable = scenario.action_cards.filter((c) => budget >= c.cost && hr >= c.hr_cost);
  const toggleSafeguard = (key) => {
    setSafeguards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSelectCard = (id) => {
    setSelectedId(id);
    setTimeout(() => {
        if(scrollRef && scrollRef.current) {
            const offset = isMobile ? 300 : 1000;
            scrollRef.current.scrollBy({ top: offset, behavior: 'smooth' });
        }
    }, 100);
  };

  const handleApply = () => {
    const action = scenario.action_cards.find((c) => c.id === selectedId);
    if (!action) return;
    onApply({ action, scope, duration, safeguards: Array.from(safeguards) });
  };

  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.decision_title_kids' : 'phases.decision_title_adult')}</h2>
      {affordable.length === 0 ? (
        <div style={{textAlign:'center'}}>
           <p style={styles.storyText}>{t(isKids ? 'decision.skip_warning_kids' : 'decision.skip_warning_adult')}</p>
           <button style={styles.primaryButton} onClick={onSkip}>{t(isKids ? 'decision.btn_skip_kids' : 'decision.btn_skip_adult')}</button>
        </div>
      ) : (
        <>
           <h3 style={styles.sideTitle}>{t(isKids ? 'decision.cards_title_kids' : 'decision.cards_title_adult')}</h3>
           <div style={styles.actionsGrid}>
             {scenario.action_cards.map((card) => {
               const canPlay = budget >= card.cost && hr >= card.hr_cost;
               const selected = selectedId === card.id;
               return (
                 <button key={card.id} style={{ ...styles.actionCard, border: selected ? `2px solid ${styles.successColor}` : styles.border, opacity: canPlay ? 1 : 0.4, cursor: canPlay ? "pointer" : "not-allowed" }} onClick={() => canPlay && handleSelectCard(card.id)}>
                   <div style={styles.actionTitle}>{card.name}</div>
                   <div style={styles.actionTooltip}>{card.tooltip}</div>
                   <div style={styles.actionCosts}>
                     <div style={{height:1, background: styles.dividerColor, margin: '8px 0'}}></div>
                     💰 {card.cost} | 👥 {card.hr_cost} | ⚡ {card.speed.toUpperCase()}
                   </div>
                 </button>
               );
             })}
           </div>
           {selectedId && (
             <div style={{marginTop: 20, padding: 16, background: styles.cardBg, borderRadius: 8, border: styles.border, animation: 'fadeIn 0.5s'}}>
               <h3 style={{...styles.sideTitle, marginTop: 0, color: styles.headingColor}}>{t(isKids ? 'decision.settings_title_kids' : 'decision.settings_title_adult')}</h3>
               
               <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={styles.settingLabel}>{t(isKids ? 'settings_labels.scope_kids' : 'settings_labels.scope_adult')}</div>
                    <div style={styles.chipRow}>
                       <Chip label={t(isKids ? 'chips.scope_targeted_kids' : 'chips.scope_targeted_adult')} active={scope==="targeted"} onClick={()=>setScope("targeted")} styles={styles}/>
                       <Chip label={t(isKids ? 'chips.scope_general_kids' : 'chips.scope_general_adult')} active={scope==="general"} onClick={()=>setScope("general")} styles={styles}/>
                    </div>
                  </div>
                  <div>
                    <div style={styles.settingLabel}>{t(isKids ? 'settings_labels.duration_kids' : 'settings_labels.duration_adult')}</div>
                    <div style={styles.chipRow}>
                       <Chip label={t(isKids ? 'chips.duration_short_kids' : 'chips.duration_short_adult')} active={duration==="short"} onClick={()=>setDuration("short")} styles={styles}/>
                       <Chip label={t(isKids ? 'chips.duration_medium_kids' : 'chips.duration_medium_adult')} active={duration==="medium"} onClick={()=>setDuration("medium")} styles={styles}/>
                       <Chip label={t(isKids ? 'chips.duration_long_kids' : 'chips.duration_long_adult')} active={duration==="long"} onClick={()=>setDuration("long")} styles={styles}/>
                    </div>
                  </div>
                  <div>
                    <div style={styles.settingLabel}>{t(isKids ? 'settings_labels.safeguards_kids' : 'settings_labels.safeguards_adult')}</div>
                    <div style={styles.chipRow}>
                       <Chip label={t(isKids ? 'chips.safeguard_transparency_kids' : 'chips.safeguard_transparency_adult')} active={safeguards.has("transparency")} onClick={()=>toggleSafeguard("transparency")} styles={styles}/>
                       <Chip label={t(isKids ? 'chips.safeguard_appeal_kids' : 'chips.safeguard_appeal_adult')} active={safeguards.has("appeal")} onClick={()=>toggleSafeguard("appeal")} styles={styles}/>
                       <Chip label={t(isKids ? 'chips.safeguard_sunset_kids' : 'chips.safeguard_sunset_adult')} active={safeguards.has("sunset")} onClick={()=>toggleSafeguard("sunset")} styles={styles}/>
                    </div>
                  </div>
               </div>
               <div style={styles.actionsRow}>
                 <button style={styles.primaryButton} onClick={handleApply}>{t(isKids ? 'decision.btn_apply_kids' : 'decision.btn_apply_adult')}</button>
               </div>
             </div>
           )}
        </>
      )}
    </div>
  );
}

function Chip({ label, active, onClick, styles }) {
  return (
    <button type="button" onClick={onClick} style={{ 
        padding: "6px 12px", 
        borderRadius: 999, 
        border: active ? `1px solid ${styles.successColor}` : styles.border, 
        background: active ? styles.chipActiveBg : styles.chipBg, 
        color: active ? '#fff' : styles.textColor, 
        fontSize: 12, 
        cursor: "pointer",
        fontWeight: active ? "bold" : "normal",
        marginRight: 4,
        marginBottom: 4
    }}>
      {label}
    </button>
  );
}

function ImmediateScreen({ scenario, results, metricsBefore, metricsAfter, onNext, isKids, styles }) {
  const { t } = useTranslation();
  const diff = (a, b) => (a - b).toFixed(1);
  const text = results.skipped ? t('feedback.skip_reason') : scenario.immediate_text.replace("{}", results.actionName || "");
  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.immediate_title_kids' : 'phases.immediate_title_adult')}</h2>
      <p style={styles.storyText}>{text}</p>
      <div style={styles.resultGrid}>
        <ResultLine label={`🛡️ ${t('metrics.security')}`} before={metricsBefore.security} after={metricsAfter.security} diff={diff(metricsAfter.security, metricsBefore.security)} styles={styles} />
        <ResultLine label={`🗽 ${t('metrics.freedom')}`} before={metricsBefore.freedom} after={metricsAfter.freedom} diff={diff(metricsAfter.freedom, metricsBefore.freedom)} styles={styles} />
        <ResultLine label={`🤝 ${t('metrics.public_trust')}`} before={metricsBefore.public_trust} after={metricsAfter.public_trust} diff={diff(metricsAfter.public_trust, metricsBefore.public_trust)} styles={styles} />
      </div>
      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onNext}>{t('common.next')}</button></div>
    </div>
  );
}

function ResultLine({ label, before, after, diff, styles }) {
  const dVal = parseFloat(diff.replace(/[()]/g, ''));
  const color = dVal > 0 ? '#34d399' : (dVal < 0 ? '#f87171' : styles.subTextColor);
  return (
    <div style={{fontSize: 14, color: styles.textColor, display: 'flex', justifyContent:'space-between', borderBottom: styles.border, padding: '4px 0'}}>
      <span>{label}</span>
      <span>{before.toFixed(0)} → {after.toFixed(0)} <span style={{color, marginLeft: 6}}>{dVal > 0 ? '+' : ''}{diff}</span></span>
    </div>
  );
}

function DelayedScreen({ scenario, results, isKids, onNext, styles }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.delayed_title_kids' : 'phases.delayed_title_adult')}</h2>
      <p style={styles.storyText}>{results.skipped ? "..." : scenario.delayed_text}</p>
      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onNext}>{t('common.next')}</button></div>
    </div>
  );
}

function ReportScreen({ metricsBefore, metricsAfter, results, onNext, isKids, styles, isDark }) {
  const { t } = useTranslation();
  
  const reportData = [
    { name: t('metrics.security'), before: metricsBefore.security, after: metricsAfter.security },
    { name: t('metrics.freedom'), before: metricsBefore.freedom, after: metricsAfter.freedom },
    { name: t('metrics.public_trust'), before: metricsBefore.public_trust, after: metricsAfter.public_trust },
    { name: t('metrics.resilience'), before: metricsBefore.resilience, after: metricsAfter.resilience },
    { name: t('metrics.fatigue'), before: metricsBefore.fatigue, after: metricsAfter.fatigue },
  ];

  let feedbackKey = 'feedback.counter_factual_other_adult';
  if(results.counter_factual === 'counter_factual_A') {
      feedbackKey = isKids ? 'feedback.counter_factual_A_kids' : 'feedback.counter_factual_A_adult';
  } else if(results.counter_factual === 'counter_factual_other') {
      feedbackKey = isKids ? 'feedback.counter_factual_other_kids' : 'feedback.counter_factual_other_adult';
  } else if(results.counter_factual === 'skip_reason') {
      feedbackKey = 'feedback.skip_reason';
  }

  const textColor = isDark ? '#cbd5e1' : '#475569';

  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.report_title_kids' : 'phases.report_title_adult')}</h2>
      
      <div style={{width: '100%', height: 300, marginTop: 20, marginBottom: 20}}>
        <ResponsiveContainer>
          <BarChart 
            data={reportData} 
            layout="vertical" 
            margin={{top: 5, right: 30, left: 40, bottom: 5}}
          >
             <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} horizontal={false} />
             <XAxis type="number" domain={[0, 100]} hide />
             <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: textColor}} />
             <RechartsTooltip 
                cursor={{fill: 'rgba(100,100,100,0.1)'}} 
                contentStyle={{backgroundColor: styles.cardBg, borderColor: styles.dividerColor, color: styles.textColor}}
             />
             <Legend 
                wrapperStyle={{paddingTop: 10}} 
                formatter={(value) => <span style={{color: textColor}}>{value}</span>}
             />
             <Bar dataKey="before" name={t('common.before')} fill="#94a3b8" barSize={12} radius={[0, 4, 4, 0]} />
             <Bar dataKey="after" name={t('common.after')} fill="#38bdf8" barSize={12} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{background: styles.cardBg, padding: 12, borderRadius: 8, marginBottom: 12, border: styles.border}}>
        <p style={{...styles.storyText, fontStyle: 'italic', color: styles.subTextColor}}>
           "{t(feedbackKey)}"
        </p>
      </div>
      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onNext}>{t('common.next')}</button></div>
    </div>
  );
}

function EndScreen({ metrics, budget, hr, history, onRestart, isKids, styles, isDark }) {
  const { t } = useTranslation();
  const score = ((metrics.security + metrics.freedom + metrics.public_trust)/3).toFixed(0);
  
  const timelineData = useMemo(() => {
    const data = history.map((m, idx) => ({ 
        step: `Kriz ${idx}`, 
        sec: m.security, 
        free: m.freedom, 
        trust: m.public_trust
    }));
    data.push({ 
        step: "Son", 
        sec: metrics.security, 
        free: metrics.freedom, 
        trust: metrics.public_trust 
    });
    return data;
  }, [history, metrics]);

  const textColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.end_title_kids' : 'phases.end_title_adult')}</h2>
      <div style={{textAlign:'center', margin: '20px 0'}}>
        <div style={{fontSize: 40, fontWeight: 'bold', color: '#10b981'}}>{score}</div>
        <div style={{color: styles.subTextColor}}>{t('phases.leadership_score')}</div>
      </div>
      
      <div style={{height: 250, marginTop: 20}}>
         <ResponsiveContainer>
            <LineChart data={timelineData}>
               <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
               <XAxis dataKey="step" tick={{fontSize: 11, fill: textColor}} />
               <YAxis domain={[0, 100]} tick={{fontSize: 11, fill: textColor}} />
               <RechartsTooltip contentStyle={{backgroundColor: styles.cardBg, border: styles.border}} />
               <Legend 
                 wrapperStyle={{paddingTop: '10px'}} 
                 formatter={(value) => <span style={{color: textColor}}>{value}</span>}
               />
               <Line type="monotone" dataKey="sec" name={t('metrics.security')} stroke="#38bdf8" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
               <Line type="monotone" dataKey="free" name={t('metrics.freedom')} stroke="#a3e635" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
               <Line type="monotone" dataKey="trust" name={t('metrics.public_trust')} stroke="#facc15" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
            </LineChart>
         </ResponsiveContainer>
      </div>

      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onRestart}>{t('header.restart_button')}</button></div>
    </div>
  );
}

function MetricsPanel({ metrics, budget, hr, isKids, styles }) {
  const { t } = useTranslation();
  const bars = [
    { label: t('metrics.budget'), val: budget, max: 100, color: '#a3e635' },
    { label: t('metrics.hr'), val: hr, max: 50, color: '#c084fc' },
    { label: t('metrics.security'), val: metrics.security, max: 100, color: '#38bdf8' },
    { label: t('metrics.freedom'), val: metrics.freedom, max: 100, color: '#a3e635' },
    { label: t('metrics.public_trust'), val: metrics.public_trust, max: 100, color: '#facc15' },
    { label: t('metrics.resilience'), val: metrics.resilience, max: 100, color: '#fb923c' },
    { label: t('metrics.fatigue'), val: metrics.fatigue, max: 100, color: '#f87171' },
  ];

  return (
    <div>
      <h4 style={styles.panelTitle}>{t('panel.metrics_title')}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bars.map((b) => (
          <div key={b.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: styles.subTextColor, marginBottom: 2 }}>
              <span>{b.label}</span>
              <span>{b.val.toFixed(0)}</span>
            </div>
            <div style={{ height: 6, background: styles.trackBg, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (b.val / b.max) * 100)}%`, background: b.color, height: '100%', transition: 'width 0.3s' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 12, fontSize: 10, color: styles.subTextColor, lineHeight: 1.4}}>
         {t('panel.fatigue_warning')}
      </div>
    </div>
  );
}

// --- STYLES GENERATOR (DİNAMİK RENKLER) ---
function getStyles(isMobile, isDark) {
  // Renk Paleti (Dark / Light)
  const colors = isDark ? {
      bg: '#020617',
      containerBg: '#030712',
      cardBg: '#0f172a',
      panelBg: '#0b1121',
      text: '#cbd5e1',
      subText: '#94a3b8',
      heading: '#ffffff',
      border: '1px solid #1e293b',
      divider: '#334155',
      accent: '#38bdf8',
      success: '#10b981',
      trackBg: '#1e293b',
      chipBg: '#1e293b',
      chipActiveBg: '#064e3b',
      headerGradient: 'linear-gradient(to right, #0f172a, #030712)'
  } : {
      bg: '#f8fafc',
      containerBg: '#ffffff',
      cardBg: '#ffffff',
      panelBg: '#f1f5f9',
      text: '#334155',
      subText: '#64748b',
      heading: '#0f172a',
      border: '1px solid #e2e8f0',
      divider: '#cbd5e1',
      accent: '#0284c7',
      success: '#059669',
      trackBg: '#e2e8f0',
      chipBg: '#f1f5f9',
      chipActiveBg: '#10b981',
      headerGradient: 'linear-gradient(to right, #ffffff, #f1f5f9)'
  };

  return {
    wrapper: {
      display: "flex",
      justifyContent: "center",
      alignItems: isMobile ? "flex-start" : "center",
      minHeight: "100vh",
      padding: isMobile ? 10 : 20,
      fontFamily: "'Inter', sans-serif",
      boxSizing: "border-box",
      background: colors.bg,
      color: colors.text,
      transition: 'background 0.3s'
    },
    gameContainer: {
      width: "100%",
      maxWidth: 1000,
      height: isMobile ? 'auto' : 'calc(100vh - 60px)',
      minHeight: isMobile ? '90vh' : 'auto',
      maxHeight: isMobile ? 'none' : 800,
      background: colors.containerBg,
      border: colors.border,
      borderRadius: 16,
      boxShadow: isDark ? "0 0 50px rgba(0,0,0,0.6)" : "0 4px 20px rgba(0,0,0,0.05)",
      overflow: isMobile ? 'visible' : 'hidden',
      display: "flex",
      flexDirection: "column"
    },
    header: {
      padding: isMobile ? "12px 16px" : "16px 24px",
      borderBottom: colors.border,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: colors.headerGradient,
      flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 10 
    },
    headerLeft: { display: "flex", gap: 12, alignItems: "center" },
    headerIcon: { fontSize: isMobile ? 20 : 24 },
    headerTitle: { fontSize: isMobile ? 16 : 18, fontWeight: 700, color: colors.heading },
    headerSubtitle: { fontSize: 12, color: colors.subText, display: isMobile ? 'none' : 'block' },
    headerBadge: { fontSize: 11, padding: "2px 8px", borderRadius: 99, border: `1px solid ${colors.accent}`, color: colors.accent, background: "rgba(56,189,248,0.1)", display: isMobile ? 'none' : 'block' },
    headerRestartButton: { fontSize: 11, padding: "4px 10px", borderRadius: 6, border: colors.border, background: "transparent", color: colors.text, cursor: "pointer" },
    langButton: { fontSize: 11, padding: "4px 8px", borderRadius: 6, background: isDark ? "#1e293b" : "#e2e8f0", color: colors.text, border: "none", cursor: "pointer", fontWeight: "bold" },
    
    mainContentGrid: {
      display: isMobile ? "flex" : "grid",
      flexDirection: "column",
      gridTemplateColumns: "2fr 1fr",
      flex: 1,
      overflow: isMobile ? 'visible' : 'hidden',
    },
    leftColumn: {
      padding: isMobile ? 16 : 24,
      borderRight: isMobile ? 'none' : colors.border,
      display: "flex",
      flexDirection: "column",
      overflowY: isMobile ? 'visible' : "auto",
    },
    rightColumn: {
      padding: 20,
      background: colors.panelBg,
      display: "flex",
      flexDirection: "column",
      gap: 16,
      overflowY: isMobile ? 'visible' : "auto",
      borderTop: isMobile ? colors.border : "none"
    },
    panelBox: {
      border: colors.border,
      borderRadius: 12,
      padding: 12,
      background: colors.cardBg,
      boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
    },
    panelTitle: { margin: "0 0 10px 0", fontSize: 14, color: colors.accent, fontWeight: 600 },
    phaseTitle: { margin: "0 0 12px 0", fontSize: isMobile ? 18 : 20, color: colors.accent, fontWeight: 600 },
    storyText: { fontSize: 14, color: colors.text, lineHeight: 1.6, whiteSpace: "pre-line" },
    missionBox: { marginTop: 20, padding: 16, borderRadius: 12, border: colors.border, background: colors.containerBg, boxShadow: "inset 0 0 20px rgba(0,0,0,0.02)" },
    missionTitle: { margin: "0 0 8px 0", fontSize: 14, color: "#f97316", fontWeight: 700 },
    primaryButton: { padding: "10px 24px", borderRadius: 999, background: colors.success, color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "transform 0.1s", boxShadow: "0 0 10px rgba(16, 185, 129, 0.3)" },
    actionsRow: { marginTop: 20, display: "flex", justifyContent: "center" },
    advisorsGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
    advisorCard: { padding: 12, background: colors.panelBg, borderRadius: 8, border: colors.border },
    advisorName: { fontSize: 13, fontWeight: "bold", color: colors.accent, marginBottom: 4 },
    advisorText: { fontSize: 12, color: colors.text },
    actionsGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 },
    actionCard: { padding: 12, borderRadius: 8, background: colors.cardBg, textAlign: "left", transition: "all 0.2s", border: colors.border },
    actionTitle: { fontSize: 14, fontWeight: "bold", color: "#f472b6", marginBottom: 6 },
    actionTooltip: { fontSize: 13, color: colors.text, marginBottom: 8, minHeight: 32, lineHeight: 1.4 },
    actionCosts: { fontSize: 12, fontWeight: "bold", color: "#60a5fa" },
    settingLabel: { fontSize: 13, color: colors.heading, fontWeight: "700", marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
    chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
    resultGrid: { marginTop: 16, borderTop: colors.border, paddingTop: 8 },
    
    // Renkleri alt komponentlere geçmek için
    textColor: colors.text,
    subTextColor: colors.subText,
    headingColor: colors.heading,
    border: colors.border,
    cardBg: colors.cardBg,
    accentColor: colors.accent,
    successColor: colors.success,
    dividerColor: colors.divider,
    chipBg: colors.chipBg,
    chipActiveBg: colors.chipActiveBg,
    trackBg: colors.trackBg
  };
}