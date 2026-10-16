"use client";

// Home owns the plan, so moving between tabs preserves all entries.
import { useRef, useState } from "react";
import UniversitySelector from "@/components/UniversitySelector";
import MajorSelector from "@/components/MajorSelector";
import AcademicYearSelector from "@/components/AcademicYearSelector";
import CourseSelector from "@/components/CourseSelector";
import APExamSelector from "@/components/APExamSelector";
import TransferUnitSummary from "@/components/TransferUnitSummary";
import SevenCoursePattern from "@/components/SevenCoursePattern";
import MajorPlan from "@/components/MajorPlan";
import Icon from "@/components/Icon";
import { useRemoteData } from "@/lib/use-remote-data";
import { STARTING_COLLEGE } from "@/lib/catalog-types";
import type { CourseCatalogEntry } from "@/lib/catalog-types";
import type { APResults } from "@/lib/ap-credit";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";
import { isGroupSatisfied } from "@/lib/planner";
import type { MajorAgreement } from "@/lib/planner";

type PlannerTab = "destination" | "courses" | "ap" | "progress" | "major";
const tabs = [
  { id: "destination", title: "Destination" },
  { id: "courses", title: "Courses" },
  { id: "ap", title: "AP credit" },
  { id: "progress", title: "Transfer progress" },
  { id: "major", title: "Major requirements" },
] as const;

export default function Home() {
  const [activeTab, setActiveTab] = useState<PlannerTab>("destination");
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);
  const [earnedUnits, setEarnedUnits] = useState<Record<string, string>>({});
  const [apResults, setAPResults] = useState<APResults>({});
  const [patternReviews, setPatternReviews] = useState<CoursePatternReviews>({});
  const workspace = useRef<HTMLElement>(null);
  const tabButtons = useRef<Partial<Record<PlannerTab, HTMLButtonElement>>>({});
  const { data: courses, isLoading: isCatalogLoading, error: catalogError } = useRemoteData<CourseCatalogEntry[]>("/api/courses");

  const agreementUrl = selectedUniversity && selectedMajor && selectedAcademicYear
    ? `/api/agreement?${new URLSearchParams({ university: selectedUniversity, major: selectedMajor, year: selectedAcademicYear })}`
    : null;
  const { data: selectedAgreement, isLoading: isPlanLoading, error: planError } = useRemoteData<MajorAgreement>(agreementUrl);

  function goToTab(tab: PlannerTab, focusPanel = true) {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      workspace.current?.scrollIntoView({ block: "start" });
      tabButtons.current[tab]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focusPanel) workspace.current?.querySelector<HTMLElement>(`#planner-panel-${tab}`)?.focus({ preventScroll: true });
    });
  }

  function moveTabFocus(key: string) {
    const availableTabs = tabs.filter(tab => tab.id !== "major" || planReady);
    const index = availableTabs.findIndex(tab => tab.id === activeTab);
    const next = key === "Home" ? 0 : key === "End" ? availableTabs.length - 1
      : (index + (key === "ArrowRight" ? 1 : -1) + availableTabs.length) % availableTabs.length;
    const tab = availableTabs[next].id;
    goToTab(tab, false);
    tabButtons.current[tab]?.focus();
  }

  function handleUniversityChange(value: string) {
    setSelectedUniversity(value);
    setSelectedMajor("");
    setSelectedAcademicYear("");
  }

  function handleMajorChange(value: string) {
    setSelectedMajor(value);
    setSelectedAcademicYear("");
  }

  function handleCourseChange(courseCode: string, isChecked: boolean) {
    setCompletedCourses(previous => isChecked
      ? previous.includes(courseCode) ? previous : previous.concat(courseCode)
      : previous.filter(course => course !== courseCode));
  }

  function handleClearCourses() {
    setCompletedCourses([]);
    setEarnedUnits({});
    setPatternReviews({});
  }

  const groups = selectedAgreement ? [...selectedAgreement.requiredGroups, ...(selectedAgreement.majorRequiredGroups ?? [])] : [];
  const checkableGroups = groups.filter(group => !group.reviewRequired);
  const completedGroups = checkableGroups.filter(group => isGroupSatisfied(group, completedCourses)).length;
  const reviewCount = selectedAgreement
    ? [...groups, ...selectedAgreement.highlyRecommendedGroups].filter(group => group.reviewRequired).length : 0;
  const campusName = selectedUniversity.replace("University of California, ", "UC ");
  const planReady = Boolean(selectedAgreement) && !isPlanLoading;
  const progressTitle = selectedAgreement?.kind === "informational" ? "Guidance available"
    : checkableGroups.length === 0 ? reviewCount > 0 ? "Adviser review needed" : "Recommendations to explore"
    : `${completedGroups} of ${checkableGroups.length} groups complete`;

  return (
    <div className="guided-planner">
      <a href="#planner-workspace" className="skip-link">Skip to planner</a>
      <header className="site-header">
        <a className="site-brand" href="#top" aria-label="Transfer Planner home">
          Transfer <span>Planner</span>
        </a>
        <div className="header-links"><span className="campus-label">Mt. SAC</span><a href="#planning-guide">How to use this planner</a></div>
      </header>

      <main className="guided-main" id="top">
        <section className="welcome">
          <h1>Plan your transfer</h1>
          <p className="welcome-description">Compare your completed Mt. SAC courses with the requirements for your intended major.</p>
        </section>

        <div className="planner-tabs" role="tablist" aria-label="Planner tabs">
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return <button key={tab.id} type="button" role="tab" id={`planner-tab-${tab.id}`} aria-controls={`planner-panel-${tab.id}`} aria-selected={active} tabIndex={active ? 0 : -1} ref={node => { tabButtons.current[tab.id] = node ?? undefined; }} className={`planner-tab ${active ? "planner-tab-active" : ""}`} disabled={tab.id === "major" && !planReady} onClick={() => goToTab(tab.id, false)} onKeyDown={event => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                moveTabFocus(event.key);
              }
            }}>{tab.title}</button>;
          })}
        </div>

        <section id="planner-workspace" className="wizard-workspace" ref={workspace} tabIndex={-1} aria-label="Transfer planner workspace">
          <div className="wizard-grid">
            <div className="wizard-main-column">
              <section hidden={activeTab !== "destination"} role="tabpanel" id="planner-panel-destination" aria-labelledby="planner-tab-destination" tabIndex={0} className="wizard-card destination-card">
                <div className="wizard-card-heading"><h2 id="destination-heading">University and major</h2><p>Choose a university, major, and agreement year to find your transfer requirements.</p></div>
                <p className="starting-point"><span>Transferring from</span><strong>{STARTING_COLLEGE}</strong></p>
                <div className="destination-fields"><UniversitySelector selectedUniversity={selectedUniversity} onUniversityChange={handleUniversityChange} /><MajorSelector selectedUniversity={selectedUniversity} selectedMajor={selectedMajor} onMajorChange={handleMajorChange} /><AcademicYearSelector selectedUniversity={selectedUniversity} selectedMajor={selectedMajor} selectedAcademicYear={selectedAcademicYear} onAcademicYearChange={setSelectedAcademicYear} /></div>
                {isPlanLoading && <p role="status" className="form-feedback">Finding your agreement...</p>}
                {planError && <p role="alert" className="error-message">{planError}</p>}
                <div className="wizard-actions"><span className="action-hint">Choose all three to view major requirements.</span><button type="button" className="button button-primary" onClick={() => goToTab("courses")}>Select courses <Icon name="arrow" size={17} /></button></div>
              </section>

              <section hidden={activeTab !== "courses"} role="tabpanel" id="planner-panel-courses" aria-labelledby="planner-tab-courses" tabIndex={0} className="wizard-card coursework-card">
                <div className="wizard-card-heading"><h2 id="courses-heading">Completed courses</h2><p>Search the Mt. SAC catalog and select the courses you&apos;ve completed.</p></div>
                <CourseSelector courses={courses ?? []} isLoading={isCatalogLoading} error={catalogError} completedCourses={completedCourses} onCourseChange={handleCourseChange} onClearCourses={handleClearCourses} showHeading={false} />
                <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("destination")}><span aria-hidden="true">←</span> Destination</button><button type="button" className="button button-primary" onClick={() => goToTab("ap")}>Add AP credit <Icon name="arrow" size={17} /></button></div>
              </section>

              <section hidden={activeTab !== "ap"} role="tabpanel" id="planner-panel-ap" aria-labelledby="planner-tab-ap" tabIndex={0} className="wizard-card ap-card">
                <div className="wizard-card-heading"><h2>AP credit</h2><p>Add your AP exams and scores, and review credit that overlaps your college courses.</p></div>
                <APExamSelector results={apResults} onChange={setAPResults} showHeading={false} />
                <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("courses")}><span aria-hidden="true">←</span> Courses</button><button type="button" className="button button-primary" onClick={() => goToTab("progress")}>View transfer progress <Icon name="arrow" size={17} /></button></div>
              </section>

              <section hidden={activeTab !== "progress"} role="tabpanel" id="planner-panel-progress" aria-labelledby="planner-tab-progress" tabIndex={0} className="wizard-card transfer-progress-card">
                <div className="wizard-card-heading"><h2>Transfer progress</h2><p>Review your transferable units and seven-course pattern. Enter earned units and course approvals below when needed.</p></div>
                <div className="transfer-progress-content">
                  <TransferUnitSummary courses={courses} isLoading={isCatalogLoading} error={catalogError} completedCourses={completedCourses} earnedUnits={earnedUnits} apResults={apResults} onEarnedUnitsChange={(code, value) => setEarnedUnits(previous => ({ ...previous, [code]: value }))} />
                  <SevenCoursePattern courses={courses} isLoading={isCatalogLoading} error={catalogError} completedCourses={completedCourses} earnedUnits={earnedUnits} apResults={apResults} reviews={patternReviews} onReviewsChange={setPatternReviews} />
                </div>
                {!planReady && <p className="form-feedback">Choose a university, major, and agreement year in Destination to view major requirements.</p>}
                <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("courses")}><span aria-hidden="true">←</span> Edit courses</button><button type="button" className="button button-primary" disabled={!planReady} onClick={() => goToTab("major")}>View major requirements <Icon name="arrow" size={17} /></button></div>
              </section>

              <section hidden={activeTab !== "major"} role="tabpanel" id="planner-panel-major" aria-labelledby="planner-tab-major" tabIndex={0} className="wizard-card results-card">
                <div className="wizard-card-heading"><h2 id="requirements-heading">Major requirements</h2><p>Review course matches and remaining requirements for your selected agreement.</p></div>
                {selectedAgreement && <div className="major-progress"><div className="progress-card"><h3>{progressTitle}</h3>{checkableGroups.length > 0 && <div className="progress-track" role="progressbar" aria-label="Checkable preparation groups completed" aria-valuenow={completedGroups} aria-valuemin={0} aria-valuemax={checkableGroups.length}><span style={{ width: `${completedGroups / checkableGroups.length * 100}%` }} /></div>}<p>{selectedAgreement.kind === "informational" ? "This agreement contains program guidance." : "Based on groups with calculable completion rules."}</p></div></div>}
                {isPlanLoading && <p role="status" className="inline-message">Loading your plan...</p>}
                {planError && <p role="alert" className="error-message">{planError}</p>}
                {selectedAgreement && <MajorPlan key={`${selectedAgreement.major}-${selectedAgreement.academicYear}`} completedCourses={completedCourses} agreement={selectedAgreement} />}
                <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToTab("progress")}><span aria-hidden="true">←</span> Transfer progress</button><button type="button" className="text-button" onClick={() => goToTab("courses")}>Edit courses</button></div>
              </section>
            </div>

            {activeTab !== "destination" && <div className="plan-context" aria-label="Plan summary"><div className="context-route">
              <div><span className="context-colleges">{planReady ? <>Mt. SAC <span aria-hidden="true">→</span> {campusName}</> : STARTING_COLLEGE}</span><strong>{planReady ? selectedMajor : "Your transfer plan"}</strong></div>
              {planReady && <span className="context-year">{selectedAcademicYear}</span>}
              <span className="context-course-count">{completedCourses.length} {completedCourses.length === 1 ? "course" : "courses"} · {Object.keys(apResults).length} AP {Object.keys(apResults).length === 1 ? "exam" : "exams"}</span>
            </div></div>}
          </div>
        </section>

        <p className="session-note">Selections are kept while this page is open.</p>
        <details id="planning-guide" className="planning-guide"><summary><strong>How to use this planner</strong><Icon name="chevron" size={17} /></summary><div className="guide-content">
          <p><strong>Destination.</strong> Choose a university, major, and agreement year to view major requirements.</p>
          <p><strong>Courses.</strong> Search the Mt. SAC catalog and select completed courses.</p>
          <p><strong>AP credit.</strong> Enter exams and scores, and exclude credit that duplicates college coursework.</p>
          <p><strong>Transfer progress.</strong> View estimated transferable units and the UC seven-course pattern. Enter variable units, grades, and approval confirmations here.</p>
          <p><strong>Major requirements.</strong> Review course matches for your destination agreement. AP scores do not automatically complete major requirements, and groups marked for adviser review won&apos;t automatically count as complete.</p>
          <p>Switch tabs freely; your entries stay in place while this page is open. Use the planner alongside official ASSIST agreements and your college adviser.</p>
        </div></details>
        <footer className="site-footer"><span>Mt. SAC course catalog <span aria-hidden="true">·</span> ASSIST articulation agreements</span><span>Transfer Planner</span></footer>
      </main>
    </div>
  );
}
