"use client";

import { useRef, useState } from "react";
import CourseSelector from "@/components/CourseSelector";
import APExamSelector from "@/components/APExamSelector";
import TransferUnitSummary from "@/components/TransferUnitSummary";
import SevenCoursePattern from "@/components/SevenCoursePattern";
import TargetCollege from "@/components/TargetCollege";
import CompletedCourseDetails from "@/components/CompletedCourseDetails";
import EnrolledCourses from "@/components/EnrolledCourses";
import ArticulationAgreements from "@/components/ArticulationAgreements";
import type { AgreementResult } from "@/components/ArticulationAgreements";
import Icon from "@/components/Icon";
import { useRemoteData } from "@/lib/use-remote-data";
import { STARTING_COLLEGE } from "@/lib/catalog-types";
import type { CourseCatalogEntry, Major } from "@/lib/catalog-types";
import type { APResults } from "@/lib/ap-credit";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";
import type { MajorAgreement } from "@/lib/planner";
import { UC_CAMPUSES, getCreditCourses, getMajorCourses } from "@/lib/transfer-plan";
import type { CampusChoice, StudentProfile } from "@/lib/transfer-plan";
import { getAPOverlap } from "@/lib/ap-overlap";
import { applyAPMajorCredit } from "@/lib/ap-major-credit";
import { getEnrolledCourses } from "@/lib/course-credit";

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
  const generatedEnrolled = generated ? getEnrolledCourses(generated.completed, generated.reviews) : [];
  const generatedFailed = generated?.completed.filter(code => generated.reviews[code]?.status !== "enrolled" && ["F", "NP", "W"].includes(generated.reviews[code]?.grade)) ?? [];
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
    const missing: string[] = [];
    if (!selectedCampuses.length) missing.push("choose a UC campus");
    if (!profile.collegeYear) missing.push("choose your current college year");
    if (!profile.entrySeason) missing.push("choose your UC entry term");
    if (!/^\d{4}$/.test(profile.entryYear) || Number(profile.entryYear) < 2020 || Number(profile.entryYear) > 2100) missing.push("enter a UC entry year from 2020 to 2100");
    const missingMajors = selectedCampuses.filter(campus => !choices[campus.id].major.trim());
    if (missingMajors.length) missing.push(`choose a major for ${missingMajors.map(campus => campus.label).join(", ")}`);
    if (missing.length) {
      setGenerationError(`In Colleges & timing: ${missing.join("; ")}.`);
      return;
    }
    if (!courses || isCatalogLoading || catalogError) {
      setGenerationError("Course catalog unavailable. Refresh and try again.");
      return;
    }
    // Capture the exact inputs used. Changes during/after this request mark it stale.
    setIsGenerating(true);
    try {
      const majorCourses = getMajorCourses(completedCourses, patternReviews);
      const agreements = await Promise.all(selectedCampuses.map(async campus => {
        const choice = choices[campus.id];
        const base = { campus: campus.label, major: choice.major.trim(), agreement: null };
        try {
          const majorResponse = await fetch(`/api/majors?${new URLSearchParams({ university: campus.name })}`);
          if (!majorResponse.ok) throw new Error("Majors unavailable");
          const majors: Major[] = await majorResponse.json();
          if (!majors.length) return { ...base, message: "No major checklist for this campus. Confirm preparation with its admissions office." };
          if (!majors.some(major => major.name === choice.major)) return { ...base, message: "Choose a listed major in Colleges & timing, then regenerate." };
          if (!choice.academicYear) return { ...base, message: "Choose an ASSIST agreement year, then regenerate." };
          const response = await fetch(`/api/agreement?${new URLSearchParams({ university: campus.name, major: choice.major, year: choice.academicYear })}`);
          if (!response.ok) throw new Error("Agreement unavailable");
          const agreement: MajorAgreement = await response.json();
          return { campus: campus.label, major: choice.major, agreement: applyAPMajorCredit(agreement, apResults, majorCourses) };
        } catch {
          return { ...base, message: "Agreement unavailable. Regenerate to retry." };
        }
      }));
      const creditCourses = getCreditCourses(completedCourses, patternReviews);
      setGenerated({ key: inputKey, profile, agreements, catalog: courses, completed: completedCourses,
        creditCourses, majorCourses, earnedUnits, apResults, reviews: patternReviews });
    } catch {
      setGenerationError("Plan could not load. Try again.");
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
            <p className="form-feedback"><a className="inline-link" href="https://admission.universityofcalifornia.edu/campuses-majors/" target="_blank" rel="noreferrer">Check entry terms and deadlines ↗</a></p>
            <fieldset className="campus-choices"><legend>Which colleges are you hoping to attend?</legend><div className="campus-checkboxes">{UC_CAMPUSES.map(campus => <label key={campus.id} className={choices[campus.id] ? "campus-option campus-option-selected" : "campus-option"}><input type="checkbox" checked={Boolean(choices[campus.id])} onChange={e => toggleCampus(campus.id, e.target.checked)} />{campus.label}</label>)}</div></fieldset>
            <div className="target-colleges">{selectedCampuses.map(campus => <TargetCollege key={campus.id} campus={campus} choice={choices[campus.id]} onChange={choice => setChoices(previous => ({ ...previous, [campus.id]: choice }))} />)}</div>
            <div className="wizard-actions"><button type="button" className="button button-primary" onClick={() => goToTab("ap")}>Continue to AP credit <Icon name="arrow" size={17} /></button></div>
          </section>
          <section hidden={activeTab !== "ap"} role="tabpanel" id="planner-panel-ap" aria-labelledby="planner-tab-ap" tabIndex={0} className="wizard-card ap-card">
            <div className="wizard-card-heading"><h2>AP credit you&apos;ve earned</h2><p>Add your exam scores, or skip this step.</p></div>
            <APExamSelector results={apResults} onChange={setAPResults} showHeading={false} overlap={apOverlap} catalogError={catalogError} showEconomicsYear={selectedCampuses.some(campus => campus.id === "los-angeles")} />
            <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("colleges")}>← Colleges & timing</button><button type="button" className="button button-primary" onClick={() => goToTab("courses")}>Continue to college courses <Icon name="arrow" size={17} /></button></div>
          </section>
          <section hidden={activeTab !== "courses"} role="tabpanel" id="planner-panel-courses" aria-labelledby="planner-tab-courses" tabIndex={0} className="wizard-card coursework-card">
            <div className="wizard-card-heading"><h2>Your college courses</h2><p>Add completed or currently enrolled Mt. SAC courses. Set each course&apos;s status below.</p></div>
            <CourseSelector courses={courses ?? []} isLoading={isCatalogLoading} error={catalogError} completedCourses={completedCourses} onCourseChange={handleCourseChange} onClearCourses={() => { setCompletedCourses([]); setEarnedUnits({}); setPatternReviews({}); }} showHeading={false} />
            {!isCatalogLoading && !catalogError && <CompletedCourseDetails courses={courses ?? []} completed={completedCourses} earnedUnits={earnedUnits} reviews={patternReviews} onUnitsChange={(code, value) => setEarnedUnits(previous => ({ ...previous, [code]: value }))} onReviewsChange={setPatternReviews} />}
            <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("ap")}>← AP credit</button><button type="button" className="button button-primary" disabled={isGenerating} onClick={() => void generatePlan()}>{isGenerating ? "Generating…" : "Generate my plan"}<Icon name="arrow" size={17} /></button></div>
          </section>
          <section hidden={activeTab !== "plan"} role="tabpanel" id="planner-panel-plan" aria-labelledby="planner-tab-plan" tabIndex={0} className="wizard-card results-card">
            <div className="wizard-card-heading"><h2>Your transfer plan</h2></div>
            <div className="generation-controls"><button type="button" className="button button-primary" disabled={isGenerating} onClick={() => void generatePlan()}>{isGenerating ? "Generating your plan…" : generated ? "Regenerate my plan" : "Generate my plan"}</button></div>
            {generationError && <div className="error-message" role="alert"><p>{generationError}</p><button type="button" className="text-button" onClick={() => goToTab("colleges")}>Edit colleges & timing</button></div>}
            {isGenerating && <p className="form-feedback" role="status">Generating your plan…</p>}
            {stale && <p className="stale-plan" role="status">Entries changed. Regenerate to update this plan.</p>}
            {!generated && !isGenerating && <p className="empty-plan">Choose your colleges, add any credit, then generate your plan.</p>}
            {generated && <>
              <div className="generated-plan-intro"><h3>Planning for {generated.profile.entrySeason} {generated.profile.entryYear}</h3><p>{generated.profile.collegeYear} · {generated.agreements.map(item => item.campus).join(" · ")}</p></div>
              <div className="transfer-progress-content">
                <EnrolledCourses codes={generatedEnrolled} catalog={generated.catalog} reviews={generated.reviews} />
                {generatedFailed.length > 0 && <p className="checklist-note">No earned units (F, NP or W): {generatedFailed.join(", ")}.</p>}
                {generated.creditCourses.some(code => !generated.reviews[code]?.grade) && <p className="checklist-note">Add final grades in College courses: {generated.creditCourses.filter(code => !generated.reviews[code]?.grade).join(", ")}. Unit and major matches may change.</p>}
                <TransferUnitSummary courses={generated.catalog} isLoading={false} error={null} completedCourses={generated.creditCourses} earnedUnits={generated.earnedUnits} apResults={generated.apResults} reviews={generated.reviews} onEarnedUnitsChange={() => {}} showInputs={false} />
                <SevenCoursePattern courses={generated.catalog} isLoading={false} error={null} completedCourses={generated.completed} earnedUnits={generated.earnedUnits} apResults={generated.apResults} reviews={generated.reviews} />
              </div>
              <ArticulationAgreements agreements={generated.agreements} completed={generated.majorCourses} enrolledCourses={generatedEnrolled} />
            </>}
            <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("courses")}>← Edit college courses</button><button type="button" className="text-button" onClick={() => goToTab("colleges")}>Edit colleges & timing</button></div>
          </section>
        </div>
        {activeTab !== "colleges" && <div className="plan-context" aria-label="Current entries"><div className="context-route"><div><span className="context-colleges">Mt. SAC → {selectedCampuses.length ? selectedCampuses.map(campus => campus.label).join(" · ") : "Choose your UC campuses"}</span><strong>{profile.entrySeason && profile.entryYear ? `${profile.entrySeason} ${profile.entryYear}` : "Your transfer goals"}</strong></div><span className="context-course-count">{completedCourses.length} courses · {Object.keys(apResults).length} AP exams</span></div></div>}
        </div>
      </section>
      <p className="session-note">Refreshing clears your entries.</p>
      <details id="planning-guide" className="planning-guide"><summary><strong>How to use this planner</strong><Icon name="chevron" size={17} /></summary><div className="guide-content"><p>1. Choose campuses, majors and your transfer term.</p><p>2. Add AP exam scores.</p><p>3. Add courses, status and final grades.</p><p>4. Generate your plan. Regenerate after editing.</p><p>Planning estimate only. Confirm requirements and deadlines with a counselor and <a className="inline-link" href="https://assist.org" target="_blank" rel="noreferrer">ASSIST ↗</a>. Major checklists cover Berkeley, UCLA and UC San Diego.</p></div></details>
      <footer className="site-footer"><span>Mt. SAC course catalog · ASSIST articulation agreements</span><span>Transfer Planner</span></footer>
    </main>
  </div>;
}
