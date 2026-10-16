"use client";

import { useRef, useState } from "react";
import CourseSelector from "@/components/CourseSelector";
import APExamSelector from "@/components/APExamSelector";
import TransferUnitSummary from "@/components/TransferUnitSummary";
import SevenCoursePattern from "@/components/SevenCoursePattern";
import TargetCollege from "@/components/TargetCollege";
import CompletedCourseDetails from "@/components/CompletedCourseDetails";
import GeneratedChecklist from "@/components/GeneratedChecklist";
import type { AgreementResult } from "@/components/GeneratedChecklist";
import Icon from "@/components/Icon";
import { useRemoteData } from "@/lib/use-remote-data";
import { STARTING_COLLEGE } from "@/lib/catalog-types";
import type { CourseCatalogEntry, Major } from "@/lib/catalog-types";
import type { APResults } from "@/lib/ap-credit";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";
import type { MajorAgreement } from "@/lib/planner";
import { UC_CAMPUSES, getCreditCourses, getMajorCourses, getPatternSuggestions } from "@/lib/transfer-plan";
import type { CampusChoice, StudentProfile } from "@/lib/transfer-plan";
import { getTransferUnitProgress } from "@/lib/transfer-units";
import { getAPOverlap } from "@/lib/ap-overlap";

type PlannerTab = "colleges" | "ap" | "courses" | "plan";
const tabs = [
  { id: "colleges", title: "1. Colleges & timing" },
  { id: "ap", title: "2. AP credit" },
  { id: "courses", title: "3. College courses" },
  { id: "plan", title: "4. Your plan" },
] as const;

type GeneratedPlan = {
  key: string; profile: StudentProfile; agreements: AgreementResult[];
  catalog: CourseCatalogEntry[]; completed: string[]; creditCourses: string[]; majorCourses: string[];
  earnedUnits: Record<string, string>; apResults: APResults; reviews: CoursePatternReviews;
  suggestions: ReturnType<typeof getPatternSuggestions>; remainingUnits: number;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<PlannerTab>("colleges");
  const [profile, setProfile] = useState<StudentProfile>({ collegeYear: "", entrySeason: "", entryYear: "" });
  const [choices, setChoices] = useState<Record<string, CampusChoice>>({});
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);
  const [earnedUnits, setEarnedUnits] = useState<Record<string, string>>({});
  const [apResults, setAPResults] = useState<APResults>({});
  const [patternReviews, setPatternReviews] = useState<CoursePatternReviews>({});
  const [generated, setGenerated] = useState<GeneratedPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const workspace = useRef<HTMLElement>(null);
  const tabButtons = useRef<Partial<Record<PlannerTab, HTMLButtonElement>>>({});
  const { data: courses, isLoading: isCatalogLoading, error: catalogError } = useRemoteData<CourseCatalogEntry[]>("/api/courses");
  const selectedCampuses = UC_CAMPUSES.filter(campus => choices[campus.id]);
  const inputKey = JSON.stringify([profile, choices, completedCourses, earnedUnits, apResults, patternReviews]);
  const stale = generated !== null && generated.key !== inputKey;
  const apOverlap = courses && !catalogError ? getAPOverlap(apResults, courses, completedCourses, earnedUnits, patternReviews) : null;

  function goToTab(tab: PlannerTab, focusPanel = true) {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      workspace.current?.scrollIntoView({ block: "start" });
      tabButtons.current[tab]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focusPanel) workspace.current?.querySelector<HTMLElement>(`#planner-panel-${tab}`)?.focus({ preventScroll: true });
    });
  }

  function moveTabFocus(key: string) {
    const index = tabs.findIndex(tab => tab.id === activeTab);
    const next = key === "Home" ? 0 : key === "End" ? tabs.length - 1
      : (index + (key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    goToTab(tabs[next].id, false);
    tabButtons.current[tabs[next].id]?.focus();
  }

  function toggleCampus(id: string, checked: boolean) {
    setChoices(previous => {
      const next = { ...previous };
      if (checked) next[id] = { major: "", academicYear: "" };
      else delete next[id];
      return next;
    });
  }

  function handleCourseChange(code: string, checked: boolean) {
    setCompletedCourses(previous => checked ? previous.includes(code) ? previous : [...previous, code] : previous.filter(value => value !== code));
    if (!checked) {
      setEarnedUnits(previous => { const next = { ...previous }; delete next[code]; return next; });
      setPatternReviews(previous => { const next = { ...previous }; delete next[code]; return next; });
    }
  }

  async function generatePlan() {
    goToTab("plan");
    setGenerationError(null);
    if (!selectedCampuses.length || !profile.collegeYear || !profile.entrySeason || !/^\d{4}$/.test(profile.entryYear) || Number(profile.entryYear) < 2020 || Number(profile.entryYear) > 2100 || selectedCampuses.some(campus => !choices[campus.id].major.trim())) {
      setGenerationError("In Colleges & timing, choose at least one campus, an intended major for each, your current college year, and a valid UC entry term and year.");
      return;
    }
    if (!courses || isCatalogLoading || catalogError) {
      setGenerationError("The course catalog must load before a plan can be generated. Refresh to retry if it failed.");
      return;
    }
    // Capture the exact inputs used. Changes during/after this request mark it stale.
    setIsGenerating(true);
    try {
      const agreements = await Promise.all(selectedCampuses.map(async campus => {
        const choice = choices[campus.id];
        const base = { campus: campus.label, major: choice.major.trim(), agreement: null };
        try {
          const majorResponse = await fetch(`/api/majors?${new URLSearchParams({ university: campus.name })}`);
          if (!majorResponse.ok) throw new Error("Majors unavailable");
          const majors: Major[] = await majorResponse.json();
          if (!majors.length) return { ...base, message: "Major agreement data for this campus has not been added yet." };
          if (!majors.some(major => major.name === choice.major)) return { ...base, message: "Choose a major from this campus’s available list in Colleges & timing, then regenerate." };
          if (!choice.academicYear) return { ...base, message: "Choose an ASSIST agreement year in Colleges & timing, then regenerate to include this major’s preparation." };
          const response = await fetch(`/api/agreement?${new URLSearchParams({ university: campus.name, major: choice.major, year: choice.academicYear })}`);
          if (!response.ok) throw new Error("Agreement unavailable");
          const agreement: MajorAgreement = await response.json();
          return { campus: campus.label, major: choice.major, agreement };
        } catch {
          return { ...base, message: "We couldn’t load this campus’s agreement. Regenerate to retry; do not treat this as an evaluated major plan." };
        }
      }));
      const creditCourses = getCreditCourses(completedCourses, patternReviews);
      const priorityCodes = agreements.flatMap(result => result.agreement?.requiredGroups
        .filter(group => !group.reviewRequired).flatMap(group => group.requirements
          .filter(requirement => requirement.articulationStatus !== "review_required")
          .flatMap(requirement => (requirement.preparationOptions ?? requirement.options).flat())) ?? []);
      setGenerated({ key: inputKey, profile, agreements, catalog: courses, completed: completedCourses,
        creditCourses, majorCourses: getMajorCourses(completedCourses, patternReviews), earnedUnits, apResults, reviews: patternReviews,
        suggestions: getPatternSuggestions(courses, completedCourses, earnedUnits, patternReviews, apResults, priorityCodes),
        remainingUnits: getTransferUnitProgress(courses, creditCourses, earnedUnits, apResults, patternReviews).remainingUnits });
    } catch {
      setGenerationError("The plan could not be generated. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return <div className="guided-planner">
    <a href="#planner-workspace" className="skip-link">Skip to planner</a>
    <header className="site-header"><a className="site-brand" href="#top" aria-label="Transfer Planner home">Transfer <span>Planner</span></a><div className="header-links"><span className="campus-label">Mt. SAC</span><a href="#planning-guide">How to use this planner</a></div></header>
    <main className="guided-main" id="top">
      <section className="welcome"><h1>Plan your transfer</h1><p className="welcome-description">Choose your UC campuses, add the credit you&apos;ve earned, and see what to work on before transfer.</p></section>
      <div className="planner-tabs" role="tablist" aria-label="Planner tabs">{tabs.map(tab => <button key={tab.id} type="button" role="tab" id={`planner-tab-${tab.id}`} aria-controls={`planner-panel-${tab.id}`} aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} ref={node => { tabButtons.current[tab.id] = node ?? undefined; }} className={`planner-tab ${activeTab === tab.id ? "planner-tab-active" : ""}`} onClick={() => goToTab(tab.id, false)} onKeyDown={event => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); moveTabFocus(event.key); }
      }}>{tab.title}</button>)}</div>
      <section id="planner-workspace" className="wizard-workspace" ref={workspace} tabIndex={-1} aria-label="Transfer planner workspace">
        <div className="wizard-grid"><div className="wizard-main-column">
          <section hidden={activeTab !== "colleges"} role="tabpanel" id="planner-panel-colleges" aria-labelledby="planner-tab-colleges" tabIndex={0} className="wizard-card destination-card">
            <div className="wizard-card-heading"><h2>Your colleges and transfer timing</h2><p>Choose every UC you&apos;re considering. You can choose a different major at each campus.</p></div>
            <p className="starting-point"><span>Transferring from</span><strong>{STARTING_COLLEGE}</strong></p>
            <div className="profile-fields">
              <div className="form-field"><label htmlFor="college-year">Current year in college</label><select id="college-year" value={profile.collegeYear} onChange={e => setProfile({ ...profile, collegeYear: e.target.value })}><option value="">Choose your year</option>{["Not in college yet", "First year", "Second year", "Third year or later", "Returning student"].map(year => <option key={year}>{year}</option>)}</select></div>
              <div className="form-field"><label htmlFor="entry-season">Planned UC entry term</label><select id="entry-season" value={profile.entrySeason} onChange={e => setProfile({ ...profile, entrySeason: e.target.value })}><option value="">Choose a term</option>{["Fall", "Winter", "Spring", "Summer"].map(season => <option key={season}>{season}</option>)}</select></div>
              <div className="form-field"><label htmlFor="entry-year">UC entry year</label><input id="entry-year" type="number" min="2020" max="2100" step="1" placeholder="2027" value={profile.entryYear} onChange={e => setProfile({ ...profile, entryYear: e.target.value })} /></div>
            </div>
            <p className="form-feedback">Your entry term is a planning goal. Check whether each campus and major accepts transfers in that term and confirm its deadlines. <a className="inline-link" href="https://admission.universityofcalifornia.edu/campuses-majors/" target="_blank" rel="noreferrer">Check UC campuses and majors ↗</a></p>
            <fieldset className="campus-choices"><legend>Which colleges are you hoping to attend?</legend><div className="campus-checkboxes">{UC_CAMPUSES.map(campus => <label key={campus.id} className={choices[campus.id] ? "campus-option campus-option-selected" : "campus-option"}><input type="checkbox" checked={Boolean(choices[campus.id])} onChange={e => toggleCampus(campus.id, e.target.checked)} />{campus.label}</label>)}</div></fieldset>
            <div className="target-colleges">{selectedCampuses.map(campus => <TargetCollege key={campus.id} campus={campus} choice={choices[campus.id]} onChange={choice => setChoices(previous => ({ ...previous, [campus.id]: choice }))} />)}</div>
            <p className="form-feedback">Detailed major agreements currently cover Berkeley. Other campus selections are saved as goals; their major preparation will be marked unavailable.</p>
            <div className="wizard-actions"><span className="action-hint">Next, add the AP credit you already have.</span><button type="button" className="button button-primary" onClick={() => goToTab("ap")}>Continue to AP credit <Icon name="arrow" size={17} /></button></div>
          </section>
          <section hidden={activeTab !== "ap"} role="tabpanel" id="planner-panel-ap" aria-labelledby="planner-tab-ap" tabIndex={0} className="wizard-card ap-card">
            <div className="wizard-card-heading"><h2>AP credit you&apos;ve earned</h2><p>Add completed AP exams and scores. If you haven&apos;t taken any, continue to college courses.</p></div>
            <APExamSelector results={apResults} onChange={setAPResults} showHeading={false} overlap={apOverlap} catalogError={catalogError} />
            <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("colleges")}>← Colleges & timing</button><button type="button" className="button button-primary" onClick={() => goToTab("courses")}>Continue to college courses <Icon name="arrow" size={17} /></button></div>
          </section>
          <section hidden={activeTab !== "courses"} role="tabpanel" id="planner-panel-courses" aria-labelledby="planner-tab-courses" tabIndex={0} className="wizard-card coursework-card">
            <div className="wizard-card-heading"><h2>College courses you&apos;ve taken</h2><p>Select completed Mt. SAC courses, then enter grades and any credit details below. Leave future coursework for your generated checklist.</p></div>
            <CourseSelector courses={courses ?? []} isLoading={isCatalogLoading} error={catalogError} completedCourses={completedCourses} onCourseChange={handleCourseChange} onClearCourses={() => { setCompletedCourses([]); setEarnedUnits({}); setPatternReviews({}); }} showHeading={false} />
            {!isCatalogLoading && !catalogError && <CompletedCourseDetails courses={courses ?? []} completed={completedCourses} earnedUnits={earnedUnits} reviews={patternReviews} onUnitsChange={(code, value) => setEarnedUnits(previous => ({ ...previous, [code]: value }))} onReviewsChange={setPatternReviews} />}
            <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("ap")}>← AP credit</button><button type="button" className="button button-primary" disabled={isGenerating} onClick={() => void generatePlan()}>{isGenerating ? "Generating…" : "Generate my plan"}<Icon name="arrow" size={17} /></button></div>
          </section>
          <section hidden={activeTab !== "plan"} role="tabpanel" id="planner-panel-plan" aria-labelledby="planner-tab-plan" tabIndex={0} className="wizard-card results-card">
            <div className="wizard-card-heading"><h2>Your transfer plan</h2><p>A remaining-course checklist, estimated UC-transferable units, and your seven-course-pattern progress.</p></div>
            <div className="generation-controls"><button type="button" className="button button-primary" disabled={isGenerating} onClick={() => void generatePlan()}>{isGenerating ? "Generating your plan…" : generated ? "Regenerate my plan" : "Generate my plan"}</button><span className="action-hint">Uses your entries from the first three tabs.</span></div>
            {generationError && <div className="error-message" role="alert"><p>{generationError}</p><button type="button" className="text-button" onClick={() => goToTab("colleges")}>Edit colleges & timing</button></div>}
            {isGenerating && <p className="form-feedback" role="status">Loading campus agreements and checking your remaining course options…</p>}
            {stale && <p className="stale-plan" role="status">Your entries have changed. This is your previous plan; regenerate it to include your latest changes.</p>}
            {!generated && !isGenerating && <p className="empty-plan">Complete Colleges & timing, add any earned AP and college credit, then generate your checklist here. You can generate a starting plan with no earned credit.</p>}
            {generated && <>
              <div className="generated-plan-intro"><h3>Planning for {generated.profile.entrySeason} {generated.profile.entryYear}</h3><p>{generated.profile.collegeYear} · {generated.agreements.map(item => item.campus).join(" · ")}</p><p>This checklist is a planning estimate, not an admission or deadline determination. Your current college year and entry term provide context; confirm course-completion deadlines for each campus and major. No semester schedule or course availability is calculated.</p></div>
              <div className="transfer-progress-content">
                {generated.completed.length !== generated.creditCourses.length && <p className="checklist-note">{generated.completed.length - generated.creditCourses.length} entered courses with F, NP or W grades are excluded from the unit estimate. Grades below C do not count as completed major preparation in this checklist.</p>}
                {generated.creditCourses.some(code => !generated.reviews[code]?.grade) && <p className="checklist-note">Some entered courses have no grade. Unit and major course matches are provisional until you enter grades in College courses.</p>}
                <TransferUnitSummary courses={generated.catalog} isLoading={false} error={null} completedCourses={generated.creditCourses} earnedUnits={generated.earnedUnits} apResults={generated.apResults} reviews={generated.reviews} onEarnedUnitsChange={() => {}} showInputs={false} />
                <SevenCoursePattern courses={generated.catalog} isLoading={false} error={null} completedCourses={generated.completed} earnedUnits={generated.earnedUnits} apResults={generated.apResults} reviews={generated.reviews} />
              </div>
              <GeneratedChecklist agreements={generated.agreements} completed={generated.majorCourses} suggestions={generated.suggestions} remainingUnits={generated.remainingUnits} />
            </>}
            <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("courses")}>← Edit college courses</button><button type="button" className="text-button" onClick={() => goToTab("colleges")}>Edit colleges & timing</button></div>
          </section>
        </div>
        {activeTab !== "colleges" && <div className="plan-context" aria-label="Current entries"><div className="context-route"><div><span className="context-colleges">Mt. SAC → {selectedCampuses.length ? selectedCampuses.map(campus => campus.label).join(" · ") : "Choose your UC campuses"}</span><strong>{profile.entrySeason && profile.entryYear ? `${profile.entrySeason} ${profile.entryYear}` : "Your transfer goals"}</strong></div><span className="context-course-count">{completedCourses.length} courses · {Object.keys(apResults).length} AP exams</span></div></div>}
        </div>
      </section>
      <p className="session-note">Entries and your generated plan are kept while this page is open. Refreshing clears them.</p>
      <details id="planning-guide" className="planning-guide"><summary><strong>How to use this planner</strong><Icon name="chevron" size={17} /></summary><div className="guide-content"><p><strong>1. Colleges & timing.</strong> Select target campuses and a major per campus. Enter your current year in college and intended UC entry term. Select an applicable source agreement year where available.</p><p><strong>2. AP credit.</strong> Enter exams and earned scores. Documented full duplicates with completed college courses are excluded automatically; partial and unmapped overlaps are flagged for review.</p><p><strong>3. College courses.</strong> Add completed Mt. SAC courses, transcript grades, completion terms and variable units. ASSIST approval dates and supported credit conditions are checked automatically. Missing dates or unresolved source conditions stay flagged.</p><p><strong>4. Your plan.</strong> Generate a remaining-course checklist with course names, UC units and pattern progress. Alternatives and choose-N groups remain choices. Admission requirements, additional degree preparation and recommendations are shown separately. Regenerate after editing entries.</p><p>Use official <a className="inline-link" href="https://assist.org" target="_blank" rel="noreferrer">ASSIST agreements</a> and your college adviser to confirm applicable years, prerequisites, credit limits and deadlines. The planner does not determine admission eligibility.</p></div></details>
      <footer className="site-footer"><span>Mt. SAC course catalog · ASSIST articulation agreements</span><span>Transfer Planner</span></footer>
    </main>
  </div>;
}
