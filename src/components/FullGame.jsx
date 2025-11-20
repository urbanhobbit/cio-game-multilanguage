import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import config from "../data/config.json";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
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

export default function FullGame() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState("adult");
  const isKids = mode === "kids";

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

  const currentScenario =
    selectedScenarioId != null ? scenariosData[selectedScenarioId] : null;

  const maxCrises = 4;

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
    if(leftColRef.current) {
      leftColRef.current.scrollTop = 0;
    }
  }, [screen]);

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

    if (securityChange > 15) {
      addNews(`📈 ${t('metrics.security')} ++: '${action.name}'`);
    }
    if (freedomCost > 15) {
      addNews(`📉 ${t('metrics.freedom')} --`);
    }
    if (safeguards?.includes("transparency")) {
      addNews(`📰 ${t('chips.safeguard_transparency_' + (isKids ? 'kids' : 'adult'))}`);
    }

    const counter_factual =
      action.id === "A"
        ? t(isKids ? 'feedback.counter_factual_A_kids' : 'feedback.counter_factual_A_adult')
        : t(isKids ? 'feedback.counter_factual_other_kids' : 'feedback.counter_factual_other_adult');

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
      counter_factual: t('feedback.skip_reason'),
    };
  };

  if (screen === "start") {
    return (
      <div style={styles.wrapper}>
        <div style={styles.gameContainer}>
           <HeaderSimple isKids={isKids} onRestart={resetGame} />
           <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
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
             />
           </div>
        </div>
      </div>
    );
  }

  if (!currentScenario) {
    return (
      <div style={styles.wrapper}>
         <div style={styles.gameContainer}>
            <p style={{padding: 20, color: 'white'}}>Scenario not found.</p>
            <button style={styles.primaryButton} onClick={resetGame}>{t('common.restart')}</button>
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
    <div style={styles.wrapper}>
      <div style={styles.gameContainer}>
        <HeaderWithStatus
          scenario={currentScenario}
          index={currentIndex}
          total={crisisSequence.length}
          isKids={isKids}
          onRestart={resetGame}
        />

        <div style={styles.mainContentGrid}>
          <div style={styles.leftColumn} ref={leftColRef}>
            {screen === "tutorial" && (
              <TutorialScreen onNext={() => setScreen("story")} isKids={isKids} />
            )}

            {screen === "story" && (
              <StoryScreen
                scenario={currentScenario}
                onNext={() => setScreen("advisors")}
                isKids={isKids}
              />
            )}

            {screen === "advisors" && (
              <AdvisorsScreen
                scenario={currentScenario}
                onNext={() => setScreen("decision")}
                isKids={isKids}
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
              />
            )}

            {screen === "delayed" && results && (
              <DelayedScreen
                scenario={currentScenario}
                results={results}
                isKids={isKids}
                onNext={() => setScreen("report")}
              />
            )}

            {screen === "report" && results && (
              <ReportScreen
                metricsBefore={history[currentIndex]}
                metricsAfter={metrics}
                results={results}
                onNext={goNextCrisisOrEnd}
                isKids={isKids}
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
              />
            )}
          </div>

          <div style={styles.rightColumn}>
            <div style={{...styles.panelBox, flex: 1}}>
               <MetricsPanel metrics={metrics} budget={budget} hr={hr} isKids={isKids} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Alt Bileşenler ---

function HeaderSimple({ isKids = false, onRestart }) {
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

function HeaderWithStatus({ scenario, index, total, isKids = false, onRestart }) {
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
        <button onClick={toggleLang} style={styles.langButton}>{i18n.language === 'tr' ? 'EN' : 'TR'}</button>
        <div style={styles.headerBadge}>{t(isKids ? 'header.badge_kids' : 'header.badge_adult')}</div>
        {onRestart && (
          <button type="button" onClick={onRestart} style={styles.headerRestartButton}>
            {t('header.restart_button')}
          </button>
        )}
      </div>
    </div>
  );
}

function StartScreen({ allScenarioIds, selectedIds, setSelectedIds, onStart, onStartTutorial, mode, setMode, isKids, scenariosData }) {
  const { t } = useTranslation();
  const toggleId = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{t('start_screen.profile_select')}</span>
        <Chip label={t('start_screen.profile_adult')} active={mode === "adult"} onClick={() => setMode("adult")} />
        <Chip label={t('start_screen.profile_kids')} active={mode === "kids"} onClick={() => setMode("kids")} />
      </div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'start_screen.welcome_kids' : 'start_screen.welcome_adult')}</h2>
      <p style={styles.storyText}>{t(isKids ? 'start_screen.intro_text_kids' : 'start_screen.intro_text_adult')}</p>
      <div style={{ marginTop: 12 }}>
        <h3 style={styles.sideTitle}>{t(isKids ? 'start_screen.scenarios_title_kids' : 'start_screen.scenarios_title_adult')}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allScenarioIds.map((id) => (
            <label key={id} style={{ borderRadius: 999, border: selectedIds.has(id) ? "1px solid #38bdf8" : "1px solid #374151", padding: "4px 10px", fontSize: 13, cursor: "pointer", background: selectedIds.has(id) ? "#0f172a" : "#020617", color: "#e2e8f0" }}>
              <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleId(id)} style={{ marginRight: 6 }} />
              {scenariosData[id].icon} {scenariosData[id].title}
            </label>
          ))}
        </div>
      </div>
      <div style={{ ...styles.actionsRow, gap: 8, justifyContent: 'flex-start' }}>
        <button style={styles.primaryButton} onClick={onStartTutorial}>{t('start_screen.btn_tutorial')}</button>
        <button style={{ ...styles.primaryButton, background: "#334155", color: "#e5e7eb" }} onClick={onStart}>{t('start_screen.btn_start')}</button>
      </div>
    </div>
  );
}

function TutorialScreen({ onNext, isKids = false }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 style={styles.phaseTitle}>{t('tutorial.title')}</h2>
      <p style={styles.storyText}>{t(isKids ? 'tutorial.desc_kids' : 'tutorial.desc_adult')}</p>
      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>{t('tutorial.btn_end')}</button>
      </div>
    </div>
  );
}

function StoryScreen({ scenario, onNext, isKids = false }) {
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

function AdvisorsScreen({ scenario, news, onNext, isKids = false }) {
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

function DecisionScreen({ scenario, budget, hr, onSkip, onApply, isKids = false, scrollRef }) {
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
            scrollRef.current.scrollTo({ top: 1000, behavior: 'smooth' });
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
                 <button key={card.id} style={{ ...styles.actionCard, border: selected ? "2px solid #10b981" : "1px solid #334155", opacity: canPlay ? 1 : 0.4, cursor: canPlay ? "pointer" : "not-allowed" }} onClick={() => canPlay && handleSelectCard(card.id)}>
                   <div style={styles.actionTitle}>{card.name}</div>
                   <div style={styles.actionTooltip}>{card.tooltip}</div>
                   <div style={styles.actionCosts}>
                     <div style={{height:1, background:'#334155', margin: '8px 0'}}></div>
                     {/* BURAYA HIZ EKLENDİ */}
                     💰 {card.cost} | 👥 {card.hr_cost} | ⚡ {card.speed.toUpperCase()}
                   </div>
                 </button>
               );
             })}
           </div>
           {selectedId && (
             <div style={{marginTop: 20, padding: 16, background: '#0f172a', borderRadius: 8, border: '1px solid #334155', animation: 'fadeIn 0.5s'}}>
               <h3 style={{...styles.sideTitle, marginTop: 0, color: '#ffffff'}}>{t(isKids ? 'decision.settings_title_kids' : 'decision.settings_title_adult')}</h3>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={styles.settingLabel}>{t(isKids ? 'settings_labels.scope_kids' : 'settings_labels.scope_adult')}</div>
                    <div style={styles.chipRow}>
                       <Chip label={t(isKids ? 'chips.scope_targeted_kids' : 'chips.scope_targeted_adult')} active={scope==="targeted"} onClick={()=>setScope("targeted")} />
                       <Chip label={t(isKids ? 'chips.scope_general_kids' : 'chips.scope_general_adult')} active={scope==="general"} onClick={()=>setScope("general")} />
                    </div>
                  </div>
                  <div>
                    <div style={styles.settingLabel}>{t(isKids ? 'settings_labels.duration_kids' : 'settings_labels.duration_adult')}</div>
                    <div style={styles.chipRow}>
                       <Chip label={t(isKids ? 'chips.duration_short_kids' : 'chips.duration_short_adult')} active={duration==="short"} onClick={()=>setDuration("short")} />
                       <Chip label={t(isKids ? 'chips.duration_medium_kids' : 'chips.duration_medium_adult')} active={duration==="medium"} onClick={()=>setDuration("medium")} />
                       <Chip label={t(isKids ? 'chips.duration_long_kids' : 'chips.duration_long_adult')} active={duration==="long"} onClick={()=>setDuration("long")} />
                    </div>
                  </div>
                  <div>
                    <div style={styles.settingLabel}>{t(isKids ? 'settings_labels.safeguards_kids' : 'settings_labels.safeguards_adult')}</div>
                    <div style={styles.chipRow}>
                       <Chip label={t(isKids ? 'chips.safeguard_transparency_kids' : 'chips.safeguard_transparency_adult')} active={safeguards.has("transparency")} onClick={()=>toggleSafeguard("transparency")} />
                       <Chip label={t(isKids ? 'chips.safeguard_appeal_kids' : 'chips.safeguard_appeal_adult')} active={safeguards.has("appeal")} onClick={()=>toggleSafeguard("appeal")} />
                       <Chip label={t(isKids ? 'chips.safeguard_sunset_kids' : 'chips.safeguard_sunset_adult')} active={safeguards.has("sunset")} onClick={()=>toggleSafeguard("sunset")} />
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

function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ 
        padding: "6px 12px", 
        borderRadius: 999, 
        border: active ? "1px solid #10b981" : "1px solid #4b5563", 
        background: active ? "#064e3b" : "#1e293b", 
        color: "#ffffff", 
        fontSize: 12, 
        cursor: "pointer",
        fontWeight: active ? "bold" : "normal"
    }}>
      {label}
    </button>
  );
}

function ImmediateScreen({ scenario, results, metricsBefore, metricsAfter, onNext, isKids }) {
  const { t } = useTranslation();
  const diff = (a, b) => (a - b).toFixed(1);
  const text = results.skipped ? t('feedback.skip_reason') : scenario.immediate_text.replace("{}", results.actionName || "");
  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.immediate_title_kids' : 'phases.immediate_title_adult')}</h2>
      <p style={styles.storyText}>{text}</p>
      <div style={styles.resultGrid}>
        <ResultLine label={`🛡️ ${t('metrics.security')}`} before={metricsBefore.security} after={metricsAfter.security} diff={diff(metricsAfter.security, metricsBefore.security)} />
        <ResultLine label={`🗽 ${t('metrics.freedom')}`} before={metricsBefore.freedom} after={metricsAfter.freedom} diff={diff(metricsAfter.freedom, metricsBefore.freedom)} />
        <ResultLine label={`🤝 ${t('metrics.public_trust')}`} before={metricsBefore.public_trust} after={metricsAfter.public_trust} diff={diff(metricsAfter.public_trust, metricsBefore.public_trust)} />
      </div>
      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onNext}>{t('common.next')}</button></div>
    </div>
  );
}

function ResultLine({ label, before, after, diff }) {
  const dVal = parseFloat(diff.replace(/[()]/g, ''));
  const color = dVal > 0 ? '#34d399' : (dVal < 0 ? '#f87171' : '#94a3b8');
  return (
    <div style={{fontSize: 14, color: '#e2e8f0', display: 'flex', justifyContent:'space-between', borderBottom: '1px solid #1e293b', padding: '4px 0'}}>
      <span>{label}</span>
      <span>{before.toFixed(0)} → {after.toFixed(0)} <span style={{color, marginLeft: 6}}>{dVal > 0 ? '+' : ''}{diff}</span></span>
    </div>
  );
}

function DelayedScreen({ scenario, results, isKids, onNext }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.delayed_title_kids' : 'phases.delayed_title_adult')}</h2>
      <p style={styles.storyText}>{results.skipped ? "..." : scenario.delayed_text}</p>
      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onNext}>{t('common.next')}</button></div>
    </div>
  );
}

function ReportScreen({ metricsBefore, metricsAfter, results, onNext, isKids }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.report_title_kids' : 'phases.report_title_adult')}</h2>
      <div style={{background: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid #334155'}}>
        <p style={{...styles.storyText, fontStyle: 'italic', color: '#94a3b8'}}>"{results.counter_factual}"</p>
      </div>
      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onNext}>{t('common.next')}</button></div>
    </div>
  );
}

function EndScreen({ metrics, budget, hr, history, onRestart, isKids }) {
  const { t } = useTranslation();
  const score = ((metrics.security + metrics.freedom + metrics.public_trust)/3).toFixed(0);
  
  const timelineData = useMemo(() => {
    const data = history.map((m, idx) => ({ step: `Kriz ${idx}`, sec: m.security, free: m.freedom }));
    data.push({ step: "Son", sec: metrics.security, free: metrics.freedom });
    return data;
  }, [history, metrics]);

  return (
    <div>
      <h2 style={styles.phaseTitle}>{t(isKids ? 'phases.end_title_kids' : 'phases.end_title_adult')}</h2>
      <div style={{textAlign:'center', margin: '20px 0'}}>
        <div style={{fontSize: 40, fontWeight: 'bold', color: '#10b981'}}>{score}</div>
        <div style={{color: '#94a3b8'}}>{t('phases.leadership_score')}</div>
      </div>
      
      <div style={{height: 200, marginTop: 20}}>
         <ResponsiveContainer>
            <LineChart data={timelineData}>
               <XAxis dataKey="step" tick={{fontSize: 10}} />
               <YAxis domain={[0, 100]} hide />
               <RechartsTooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
               <Line type="monotone" dataKey="sec" stroke="#10b981" strokeWidth={2} dot={false} />
               <Line type="monotone" dataKey="free" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
         </ResponsiveContainer>
      </div>

      <div style={styles.actionsRow}><button style={styles.primaryButton} onClick={onRestart}>{t('header.restart_button')}</button></div>
    </div>
  );
}

function MetricsPanel({ metrics, budget, hr, isKids }) {
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', marginBottom: 2 }}>
              <span>{b.label}</span>
              <span>{b.val.toFixed(0)}</span>
            </div>
            <div style={{ height: 6, background: '#1e293b', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (b.val / b.max) * 100)}%`, background: b.color, height: '100%', transition: 'width 0.3s' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 12, fontSize: 10, color: '#64748b', lineHeight: 1.4}}>
         {t('panel.fatigue_warning')}
      </div>
    </div>
  );
}

/* ---------------------- STYLES ---------------------- */
const styles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    padding: 20,
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    background: '#020617'
  },
  gameContainer: {
    width: "100%",
    maxWidth: 1000,
    height: 'calc(100vh - 60px)',
    maxHeight: 800,
    background: "#030712",
    border: "1px solid #1e293b",
    borderRadius: 16,
    boxShadow: "0 0 50px rgba(0,0,0,0.6), 0 0 10px rgba(34, 211, 238, 0.1)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column"
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(to right, #0f172a, #030712)",
    flexShrink: 0
  },
  headerLeft: { display: "flex", gap: 12, alignItems: "center" },
  headerIcon: { fontSize: 24 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: "#f8fafc" },
  headerSubtitle: { fontSize: 12, color: "#94a3b8" },
  headerBadge: { fontSize: 11, padding: "2px 8px", borderRadius: 99, border: "1px solid #38bdf8", color: "#e0f2fe", background: "rgba(56,189,248,0.1)" },
  headerRestartButton: { fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer" },
  langButton: { fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "#1e293b", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" },
  
  mainContentGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    flex: 1,
    overflow: "hidden",
  },
  leftColumn: {
    padding: 24,
    borderRight: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  rightColumn: {
    padding: 20,
    background: "#0b1121",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto",
  },
  panelBox: {
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 12,
    background: "#0f172a",
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)"
  },
  panelTitle: { margin: "0 0 10px 0", fontSize: 14, color: "#a5b4fc", fontWeight: 600 },
  phaseTitle: { margin: "0 0 12px 0", fontSize: 20, color: "#60a5fa", fontWeight: 600 },
  storyText: { fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-line" },
  missionBox: { marginTop: 20, padding: 16, borderRadius: 12, border: "1px solid #334155", background: "#020617", boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)" },
  missionTitle: { margin: "0 0 8px 0", fontSize: 14, color: "#f97316", fontWeight: 700 },
  primaryButton: { padding: "10px 24px", borderRadius: 999, background: "#10b981", color: "#022c22", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "transform 0.1s", boxShadow: "0 0 10px rgba(16, 185, 129, 0.3)" },
  actionsRow: { marginTop: 20, display: "flex", justifyContent: "center" },
  advisorsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
  advisorCard: { padding: 12, background: "#1e293b", borderRadius: 8, border: "1px solid #334155" },
  advisorName: { fontSize: 13, fontWeight: "bold", color: "#38bdf8", marginBottom: 4 },
  advisorText: { fontSize: 12, color: "#e2e8f0" },
  actionsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 },
  actionCard: { padding: 12, borderRadius: 8, background: "#0f172a", textAlign: "left", transition: "all 0.2s" },
  actionTitle: { fontSize: 14, fontWeight: "bold", color: "#f472b6", marginBottom: 6 },
  actionTooltip: { fontSize: 13, color: "#e2e8f0", marginBottom: 8, minHeight: 32, lineHeight: 1.4 },
  actionCosts: { fontSize: 12, fontWeight: "bold", color: "#60a5fa" },
  settingLabel: { fontSize: 13, color: "#ffffff", fontWeight: "700", marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  resultGrid: { marginTop: 16, borderTop: "1px solid #334155", paddingTop: 8 }
};