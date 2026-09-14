import React from "react";
import { ArrowRight } from "lucide-react";
import { getDiseaseGuidance } from "../services/diseaseGuidance.js";
import { getDiseaseResultStatusLabel } from "../../../shared/diseaseTaxonomy.js";

function GuidanceItems({ items, fallback }) {
  return items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{fallback}</p>;
}

export function DiseaseActionGuidance({ result, onCheckAnother }) {
  const guidance = getDiseaseGuidance(result);
  const noDiseaseSpecificAction = "No disease-specific action is shown without a verified source for this returned diagnosis.";
  const imageStatus = getDiseaseResultStatusLabel(result?.status) || "Initial indication";

  return <section className="disease-guidance" aria-label="Post-detection guidance">
    <div className="disease-guidance-card">
      <p className="section-kicker">03 / IMAGE QUALITY</p><h3>Image quality</h3><p className="disease-status-text">{imageStatus}</p>
    </div>
    {guidance.hasVerifiedGuidance && <div className="disease-guidance-card">
      <p className="section-kicker">04 / VISIBLE SYMPTOMS</p><h3>What to compare</h3>
      <GuidanceItems items={guidance.visibleSymptoms} fallback={noDiseaseSpecificAction}/>
      {guidance.affectedPlantParts.length > 0 && <p className="disease-guidance-detail"><strong>Affected parts:</strong> {guidance.affectedPlantParts.join(", ")}.</p>}
      {guidance.progression && <p className="disease-guidance-detail">{guidance.progression}</p>}
    </div>}
    <div className="disease-guidance-card">
      <p className="section-kicker">{guidance.hasVerifiedGuidance ? "05" : "04"} / WHAT TO DO NOW</p><h3>What to do now</h3>
      <GuidanceItems items={guidance.whatToDoNow} fallback={noDiseaseSpecificAction}/>
    </div>
    <div className="disease-guidance-card">
      <p className="section-kicker">{guidance.hasVerifiedGuidance ? "06" : "05"} / WHAT TO AVOID</p><h3>What to avoid</h3>
      <GuidanceItems items={guidance.whatToAvoid} fallback={noDiseaseSpecificAction}/>
    </div>
    {guidance.caution && <div className="disease-guidance-caution"><strong>{guidance.caution}</strong></div>}
    {guidance.hasVerifiedGuidance && <div className="disease-guidance-card">
      <p className="section-kicker">07 / PREVENTION</p><h3>Reduce future spread</h3>
      <GuidanceItems items={guidance.prevention} fallback={noDiseaseSpecificAction}/>
    </div>}
    <div className="disease-guidance-card">
      <p className="section-kicker">{guidance.hasVerifiedGuidance ? "08" : "06"} / TREATMENT GUIDANCE</p><h3>Treatment guidance</h3>
      <p>{guidance.treatment}</p>
      {guidance.source && <p className="disease-guidance-source">Verified source: <a href={guidance.source.url} target="_blank" rel="noopener noreferrer">{guidance.source.organization} — {guidance.source.title}</a> <span>(reviewed {guidance.source.reviewDate})</span></p>}
    </div>
    {guidance.hasVerifiedGuidance && <div className="disease-guidance-card">
      <p className="section-kicker">09 / MONITOR AND RECHECK</p><h3>Monitor and recheck</h3>
      <GuidanceItems items={guidance.monitor} fallback="Monitor the crop and seek confirmation before treatment."/>
    </div>}
    <div className="disease-guidance-card">
      <p className="section-kicker">{guidance.hasVerifiedGuidance ? "10" : "07"} / WHEN TO SEEK EXPERT HELP</p><h3>When to seek expert help</h3><p>{guidance.expertReferral}</p>
    </div>
    <div className="disease-guidance-card disease-guidance-next"><div>
      <p className="section-kicker">{guidance.hasVerifiedGuidance ? "11" : "08"} / NEXT ACTIONS</p><h3>Next actions</h3>
      <p>{guidance.hasVerifiedGuidance ? "These are source-backed suggestions and are not a substitute for local agricultural diagnosis." : "Check another image after following the image guidance above."}</p>
    </div><button className="button button--leaf" type="button" onClick={onCheckAnother}>Check another image <ArrowRight size={15}/></button></div>
  </section>;
}
