"use client";

// Home owns the plan, so moving between steps preserves the selected courses.
import { useRef, useState } from "react";
import UniversitySelector from "@/components/UniversitySelector";
import MajorSelector from "@/components/MajorSelector";
import AcademicYearSelector from "@/components/AcademicYearSelector";
import CourseSelector from "@/components/CourseSelector";
import MajorPlan from "@/components/MajorPlan";
import Icon from "@/components/Icon";
import { useRemoteData } from "@/lib/use-remote-data";
import { STARTING_COLLEGE } from "@/lib/catalog-types";
import { isGroupSatisfied } from "@/lib/planner";
import type { MajorAgreement } from "@/lib/planner";

type PlannerStep = 1 | 2 | 3;
const steps = [
  { number: 1, title: "University & major", short: "Destination" },
  { number: 2, title: "Completed courses", short: "Courses" },
  { number: 3, title: "Requirements", short: "Requirements" },
] as const;

export default function Home() {
  const [activeStep, setActiveStep] = useState<PlannerStep>(1);
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);
  const workspace = useRef<HTMLElement>(null);

  const agreementUrl = selectedUniversity && selectedMajor && selectedAcademicYear
    ? `/api/agreement?${new URLSearchParams({ university: selectedUniversity, major: selectedMajor, year: selectedAcademicYear })}`
    : null;
  const { data: selectedAgreement, isLoading: isPlanLoading, error: planError } = useRemoteData<MajorAgreement>(agreementUrl);

  function goToStep(step: PlannerStep) {
    setActiveStep(step);
    requestAnimationFrame(() => {
      workspace.current?.scrollIntoView({ block: "start" });
      workspace.current?.focus({ preventScroll: true });
    });
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

        <nav className="step-navigation" aria-label="Planner steps">
          {steps.map(step => {
            const active = activeStep === step.number;
            const done = step.number === 1 ? planReady : step.number === 2 && completedCourses.length > 0;
            return <button key={step.number} type="button" className={`step-tab ${active ? "step-active" : ""} ${done ? "step-done" : ""}`} aria-current={active ? "step" : undefined} disabled={step.number === 3 && !planReady} onClick={() => goToStep(step.number)}>
              <span className="step-circle">{done && !active ? <Icon name="check" size={16} /> : step.number}</span><span className="step-tab-text"><strong className="step-full-title">{step.title}</strong><strong className="step-short-title">{step.short}</strong></span>
            </button>;
          })}
        </nav>

        <section id="planner-workspace" className="wizard-workspace" ref={workspace} tabIndex={-1} aria-label={`Step ${activeStep}: ${steps[activeStep - 1].title}`}>
          <div className="wizard-grid">
            <div className="wizard-main-column">
              <section hidden={activeStep !== 1} aria-labelledby="destination-heading" className="wizard-card destination-card">
                <div className="wizard-card-heading"><h2 id="destination-heading">University and major</h2><p>Choose a university, major, and agreement year to find your transfer requirements.</p></div>
                <p className="starting-point"><span>Transferring from</span><strong>{STARTING_COLLEGE}</strong></p>
                <div className="destination-fields"><UniversitySelector selectedUniversity={selectedUniversity} onUniversityChange={handleUniversityChange} /><MajorSelector selectedUniversity={selectedUniversity} selectedMajor={selectedMajor} onMajorChange={handleMajorChange} /><AcademicYearSelector selectedUniversity={selectedUniversity} selectedMajor={selectedMajor} selectedAcademicYear={selectedAcademicYear} onAcademicYearChange={setSelectedAcademicYear} /></div>
                {isPlanLoading && <p role="status" className="form-feedback">Finding your agreement...</p>}
                {planError && <p role="alert" className="error-message">{planError}</p>}
                <div className="wizard-actions"><span className="action-hint">All three selections are required.</span><button type="button" className="button button-primary" disabled={!planReady} onClick={() => goToStep(2)}>Continue to courses <Icon name="arrow" size={17} /></button></div>
              </section>

              <section hidden={activeStep !== 2} aria-labelledby="courses-heading" className="wizard-card coursework-card">
                <div className="wizard-card-heading"><h2 id="courses-heading">Completed courses</h2><p>Search the Mt. SAC catalog and select the courses you&apos;ve completed.</p></div>
                <CourseSelector completedCourses={completedCourses} onCourseChange={handleCourseChange} onClearCourses={() => setCompletedCourses([])} showHeading={false} />
                <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToStep(1)}><span aria-hidden="true">←</span> University & major</button><button type="button" className="button button-primary" disabled={!planReady} onClick={() => goToStep(3)}>Review requirements <Icon name="arrow" size={17} /></button></div>
                {!planReady && <p className="form-feedback">Choose a university, major, and year in step 1 to review requirements.</p>}
              </section>

              <section hidden={activeStep !== 3} aria-labelledby="requirements-heading" className="wizard-card results-card">
                <div className="wizard-card-heading"><h2 id="requirements-heading">Transfer requirements</h2><p>Review course matches and remaining requirements for your selected agreement.</p></div>
                {isPlanLoading && <p role="status" className="inline-message">Loading your plan...</p>}
                {planError && <p role="alert" className="error-message">{planError}</p>}
                {selectedAgreement && <MajorPlan key={`${selectedAgreement.major}-${selectedAgreement.academicYear}`} completedCourses={completedCourses} agreement={selectedAgreement} />}
                <div className="wizard-actions"><button type="button" className="button button-back" onClick={() => goToStep(2)}><span aria-hidden="true">←</span> Edit coursework</button><button type="button" className="text-button" onClick={() => goToStep(1)}>Change destination</button></div>
              </section>
            </div>

            {activeStep !== 1 && <div className="plan-context" aria-label="Plan summary">
              {planReady && <div className="context-route"><div><span className="context-colleges">Mt. SAC <span aria-hidden="true">→</span> {campusName}</span><strong>{selectedMajor}</strong></div><span className="context-year">{selectedAcademicYear}</span><span className="context-course-count">{completedCourses.length} {completedCourses.length === 1 ? "course" : "courses"} selected</span></div>}
              {activeStep === 3 && selectedAgreement && <div className="progress-card"><h3>{progressTitle}</h3>{checkableGroups.length > 0 && <div className="progress-track" role="progressbar" aria-label="Checkable preparation groups completed" aria-valuenow={completedGroups} aria-valuemin={0} aria-valuemax={checkableGroups.length}><span style={{ width: `${completedGroups / checkableGroups.length * 100}%` }} /></div>}<p>{selectedAgreement.kind === "informational" ? "This agreement contains program guidance." : "Based on groups with calculable completion rules."}</p></div>}
            </div>}
          </div>
        </section>

        <p className="session-note">Selections are kept while this page is open.</p>
        <details id="planning-guide" className="planning-guide"><summary><strong>How to use this planner</strong><Icon name="chevron" size={17} /></summary><div className="guide-content"><p><strong>Choose a university and major.</strong> Your university, major, and agreement year determine the course requirements shown.</p><p><strong>Select completed courses.</strong> Search the Mt. SAC catalog. You can move back and forth between steps to change your selections.</p><p><strong>Review requirements.</strong> Course matches update from your selections. Groups marked for adviser review won&apos;t automatically count as complete.</p><p>Use the planner alongside the official ASSIST agreement and your college adviser. Grades, deadlines, and other admission conditions still apply.</p></div></details>
        <footer className="site-footer"><span>Mt. SAC course catalog <span aria-hidden="true">·</span> ASSIST articulation agreements</span><span>Transfer Planner</span></footer>
      </main>
    </div>
  );
}
