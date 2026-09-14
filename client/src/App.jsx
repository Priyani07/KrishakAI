import React, { useEffect, useRef, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import {
  ArrowRight, IndianRupee,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  CloudSun,
  Droplets,
  Leaf,
  Menu,
  MessageCircle,
  LocateFixed,
  ShieldCheck,
  Sprout,
  Moon,
  Sun,
  Tractor,
  TrendingUp,
  X,
} from "lucide-react";
import "./index.css";
import { loadMapScript, MapView } from "./components/Map";
import { getWeather, getWeatherForCoordinates } from "./services/weatherService.js";
import { fetchMarketPrices } from "./services/marketPriceService.js";
import { analyzeSoilImage, detectDisease } from "./services/phase3Services.js";
import { applyPlantVillageSecondaryValidation, disposePlantVillageSecondaryValidator } from "./services/plantVillageSecondaryValidator.js";
import { DiseaseActionGuidance } from "./components/DiseaseActionGuidance.jsx";
import { CommunityDiscussionDetails, CommunityDiscussionForum } from "./components/CommunityDiscussionViews.jsx";
import { getSoilReferenceOptions, getSoilTest, normalizeReferenceOption, reverseGeocodeSoilLocation } from "./services/soilTestService.js";
import { SoilLocationPicker } from "./components/SoilLocationPicker.jsx";
import { analyzeSoilPhoto, chartAnimationStyle, chartMax, chartWidth, chooseLatestSoilYear, geolocationErrorMessage, normalizeCoordinates, photoOnlyMessage, privacyMessage, coordinatePrivacyMessage, noChemistryMessage, sourceOnlyMessage, latestYearMessage, sourceLocationSummary, chartTooltip, reducedMotion, PHOTO_ACCEPT, PHOTO_CAPTURE, resetPhotoState } from "./soilTestingExperience.js";
import { createSoilTestRequestGuard, resetSoilTestCascade, SOIL_TEST_DOWNSTREAM } from "./soilTestCascade.js";
import { buildDiscussionPayload, createDiscussion, createDiscussionComment, deleteComplaint, deleteDiscussionComment, getAdminComplaints, getAdminFarmerComplaints, getAdminFarmers, getAdminStats, getComplaint, getDiscussionComments, getDiscussions, getMyComplaints, getDiscussion, openChatConnection, submitComplaint, updateComplaint, updateDiscussionComment } from "./services/phase4Services.js";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext.tsx";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext.jsx";
import { askFarmerChatbot } from "./services/chatbotService.js";
import { Streamdown } from "streamdown";
import { VoiceNavigationControl } from "./components/VoiceNavigationControl.jsx";
import { LiveIntrusionMonitor } from "./components/LiveIntrusionMonitor.jsx";
import { IntrusionUploadPanel } from "./components/IntrusionUploadPanel.jsx";
import { IRRIGATION_STATUS, buildIrrigationRecommendation, createPlannerTask, getPlannerTaskPriority, validatePlannerInputs } from "./irrigationPlanner.js";
import { filterReferenceSeeds, getCropReferenceGuidance } from "./cropSeedReferenceRegistry.js";

const mark = "krishak-mark (2).svg";
const heroImage = "/manus-storage/krishak-hub-hero_83017072.webp";
const fieldImage = "/manus-storage/krishak-field-detail_05c7e3a9.webp";
const networkTexture = "/manus-storage/krishak-network-texture_7aee977c.webp";
const WORLD_MAP_VIEWPORT = Object.freeze({ lat: 20.5937, lng: 78.9629 });

const navItems = [
  { href: "/", label: "Home", farmerOnly: false },
  { href: "/disease-farm-intrusion", label: "Disease Detection & Farm Intrusion", farmerOnly: true },
  { href: "/guide", label: "Farmer's Guide", farmerOnly: true },
  { href: "/community", label: "Community", farmerOnly: false },
  { href: "/chatbot", label: "Krishak AI", farmerOnly: false },
];

const hubCards = [
  { href: "/planner", eyebrow: "FIELD TOOL", title: "Planner", description: "Build a deterministic irrigation recommendation, add optional server-side AI explanation when configured, and keep a session task list.", icon: Tractor, tone: "violet" },
  { href: "/weather", eyebrow: "FIELD TOOL", title: "Weather App", description: "Search a location, use your current coordinates, or optionally pick a map point for current conditions and forecast context.", icon: CloudSun, tone: "sky" },
  { href: "/disease-farm-intrusion", eyebrow: "IMAGE TOOLS", title: "Disease Detection & Farm Intrusion", description: "Submit crop images to the configured Kindwise pipeline, or run COCO-SSD intrusion checks locally in your browser.", icon: ShieldCheck, tone: "coral" },
  { href: "/soil-analysis", eyebrow: "IMAGE TOOL", title: "Soil Analysis", description: "Upload a soil image for cautious AI-based observations about likely type, visible texture, crops, irrigation, and basic management.", icon: Droplets, tone: "leaf" },
  { href: "/market-prices", eyebrow: "MARKET", title: "Market Prices", description: "Check current crop market prices and make better selling decisions.", icon: TrendingUp, tone: "indigo" },
  { href: "/guide", eyebrow: "FIELD GUIDE", title: "Farmers Guide", description: "Explore the existing soil-testing, seed, fertilizer, soil-type, and crop-reference guidance tools.", icon: Leaf, tone: "ochre" },
];

function Logo({ compact = false }) {
  const { user } = useAuth();
  return (
    <Link
      href={isAdminUser(user) ? "/admin" : "/"}
      className={`brand ${compact ? "brand--compact" : ""}`}
      aria-label={isAdminUser(user) ? "Admin Dashboard" : "Krishak home"}
    >
      <img src={mark} alt="Krishak mark" />
      <span>KRISHAK</span>
    </Link>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Logo />
        <nav className={`main-nav ${open ? "main-nav--open" : ""}`} aria-label="Primary navigation">
        {navItems
  .filter(
    (item) =>
      !isAdminUser(user) ||
      (item.href !== "/disease-farm-intrusion" && item.href !== "/guide")
  )
  .map((item) => {
    if (isAdminUser(user) && item.href === "/") {
      return (
        <Link
          key={item.href}
          href="/admin"
          className={`nav-link ${
            location === "/admin" ? "nav-link--active" : ""
          }`}
          onClick={() => setOpen(false)}
        >
          Admin Dashboard
        </Link>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`nav-link ${
          location === item.href ? "nav-link--active" : ""
        }`}
        onClick={() => setOpen(false)}
      >
        {item.label}
      </Link>
    );
  })}

  </nav>
    <div className="nav-account-controls">
      <VoiceNavigationControl navigate={navigate} />

      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
  >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

  <div className="nav-account">
    {isAuthenticated ? (
      <Link href="/profile" className="nav-account-link">Profile</Link>
    ) : (
      <Link href="/login" className="nav-account-link">Login</Link>
    )}
  </div>
</div>
      </div>
    </header>
  );
}

function CommunityFooter() {
  return (
    <footer className="community-footer">
      <div className="footer-shell footer-shell--community">
        <div>
          <Logo compact />
          <p className="footer-note">Made for clearer field decisions.</p>
        </div>
        <div className="social-links" aria-label="Social links">
          <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer">Twitter</a>
          <a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
          <a href="https://linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
}

function AgriculturalFooter() {
  return (
    <footer className="agri-footer" style={{ backgroundImage: `linear-gradient(90deg, rgba(7, 35, 19, .96), rgba(10, 56, 30, .87)), url(${networkTexture})` }}>
      <div className="footer-shell agri-footer-grid">
        <div className="footer-brand-column">
          <Logo compact />
          <p>Practical tools and better context for the people growing tomorrow.</p>
          <form className="newsletter-form" onSubmit={(event) => { event.preventDefault(); event.currentTarget.classList.add("newsletter-form--submitted"); }}>
            <label htmlFor="newsletter">Keep in the loop</label>
            <div>
              <input id="newsletter" type="email" placeholder="Enter your email" aria-label="Email address" />
              <button type="submit">Go</button>
            </div>
            <small>Subscription service will connect when configured.</small>
          </form>
        </div>
        <div>
          <p className="footer-heading">Explore</p>
          <div className="footer-link-list">
            <Link href="/community">About</Link>
            <Link href="/resources">Legal Notices</Link>
            <Link href="/resources">Privacy Notices</Link>
            <Link href="/resources">Security Information</Link>
            <Link href="/resources">Trust Center</Link>
          </div>
        </div>
        <div>
          <p className="footer-heading">Recent Posts</p>
          <div className="recent-post">
            <img src={fieldImage} alt="Crop field detail" />
            <div><span>Field notes</span><strong>Growing with better context</strong></div>
          </div>
          <div className="recent-post">
            <img src={heroImage} alt="Aerial farm landscape" />
            <div><span>Krishak journal</span><strong>Tools that stay close to the field</strong></div>
          </div>
        </div>
        <div>
          <p className="footer-heading">Contact Info</p>
          <div className="contact-list">
            <p><strong>Address</strong><span>AI agriculture support desk</span></p>
            <p><strong>Email</strong><span>hello@krishak.example</span></p>
            <p><strong>Phone</strong><span>+91 00000 00000</span></p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function PageFrame({ children, footer = "community" }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main>{children}</main>
      {footer === "agricultural" ? <AgriculturalFooter /> : <CommunityFooter />}
    </div>
  );
}

function MainHub() {
  return (
    <PageFrame footer="agricultural">
      <section className="hub-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 26, 18, .76), rgba(5, 26, 18, .32)), url(${heroImage})` }}>
        <div className="content-width hub-hero-content">
          <p className="eyebrow eyebrow--light">KRISHAK / Smart Agriculture Platform</p>
          <h1>Make the next field decision with better context.</h1>
          <p className="hero-copy">A connected starting point for planning, weather, crop health, soil insight, and farmer support.</p>
          <div className="hero-actions">
            <Link href="/planner" className="button button--ochre">Open the Planner <ArrowRight size={16} /></Link>
            <Link href="/guide" className="text-link text-link--light">Browse the guide <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="hub-intro content-width">
        <div>
          <p className="eyebrow">THE KRISHAK TOOLSET</p>
          <h2>Choose a tool, then keep moving.</h2>
        </div>
        <p>Start with the information closest to your work today. Every card below leads to a dedicated route, with deeper workflows arriving module by module.</p>
      </section>

      <section className="hub-cards content-width" aria-label="Krishak tools">
        {hubCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className={`hub-card hub-card--${card.tone}`} style={{ "--card-order": index }}>
              <div className="hub-card-top"><span className="card-index">0{index + 1}</span><Icon size={26} strokeWidth={1.7} /></div>
              <p className="eyebrow">{card.eyebrow}</p>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="card-action">Explore now <ArrowRight size={15} /></span>
            </Link>
          );
        })}
      </section>

      <section className="hub-feature content-width">
        <div className="hub-feature-image" style={{ backgroundImage: `url(${fieldImage})` }} aria-label="Healthy crops in a field" />
        <div className="hub-feature-copy">
          <p className="eyebrow">A PRACTICAL STARTING POINT</p>
          <h2>From soil notes to community support.</h2>
          <p>Krishak brings the small decisions around a farm into one clear structure. Phase 1 establishes the routes and shared experience; each tool will grow into its own focused workflow.</p>
          <div className="feature-points"><span><Check size={16} /> Clear routes</span><span><Check size={16} /> Honest result states</span><span><Check size={16} /> Farmer-first context</span></div>
        </div>
      </section>
    </PageFrame>
  );
}

const pageDetails = {
  "/planner": { eyebrow: "FIELD TOOL", title: "Irrigation Planner", summary: "The planner will help organize watering priorities, irrigation tasks, and field context without pretending to generate recommendations before the planning module is connected.", icon: Tractor, next: "Planner workflows arrive in the next build phase." },
  "/weather": { eyebrow: "FIELD TOOL", title: "Weather App", summary: "Current conditions and forecast context will support better decisions about timing, irrigation, and field work.", icon: CloudSun, next: "Weather data integration arrives in the next build phase." },
  "/disease-detection": { eyebrow: "AI + CV", title: "Disease Detection & Farm Intrusion", summary: "This area will combine crop-image disease analysis with a separate animal-intrusion workflow. No predictions are shown until a real analysis service is connected.", icon: ShieldCheck, next: "Detection workflows arrive in a later build phase." },
  "/animal-intrusion": { eyebrow: "AI + CV", title: "Animal Intrusion Detection", summary: "A focused route for the farm-intrusion capability shown in the approved blueprint. It will accept the intended image or camera workflow when implemented.", icon: ShieldCheck, next: "Intrusion analysis arrives in a later build phase." },
  "/soil-analysis": { eyebrow: "IMAGE TOOL", title: "Soil Analysis", summary: "Upload a soil image for cautious AI-based visual observations and general field guidance without laboratory or sensor claims.", icon: Droplets, next: "A configured server-side AI provider is required for analysis." },
  "/community-forum": { eyebrow: "COMMUNITY", title: "Agriculture Forum", summary: "A connected forum entry point for farmer discussion, Sikayat Kendra support, community events, and market context.", icon: MessageCircle, next: "Forum persistence and interactions arrive in a later build phase." },
  "/guide": { eyebrow: "FIELD GUIDE", title: "Farmer's Guide", summary: "A practical guide index for soil testing, hybrid seeds, fertilizers, soil types, and crop recommendation tools.", icon: Leaf, next: "Choose a guide tool below to explore its Phase 1 route.", links: [{ href: "/guide/soil-testing", label: "Soil Testing" }, { href: "/guide/hybrid-seed", label: "Hybrid Seed" }, { href: "/guide/fertilizers", label: "Fertilizers" }, { href: "/guide/soil-types", label: "Soil Types" }] },
  "/guide/soil-testing": { eyebrow: "FIELD GUIDE", title: "Soil Testing", summary: "Soil testing procedures, crop and soil selectors, and an N/P/K chart will be implemented here without presenting fabricated readings.", icon: Droplets, next: "Soil testing tools arrive in a later build phase." },
  "/guide/hybrid-seed": { eyebrow: "FIELD GUIDE", title: "Hybrid Seed Catalogue", summary: "A filtered catalogue for hybrid seed options by soil type and crop type, matching the approved reference flow.", icon: Sprout, next: "Seed catalogue data arrives in a later build phase." },
  "/guide/fertilizers": { eyebrow: "FIELD GUIDE", title: "Fertilizer Catalogue", summary: "A filtered catalogue for fertilizer options, including nitrogen, phosphorus, potassium, soil fit, and crop fit.", icon: Sprout, next: "Fertilizer catalogue data arrives in a later build phase." },
  "/guide/soil-types": { eyebrow: "FIELD GUIDE", title: "Soil Types & Crop Recommendation", summary: "Soil type cards, pH context, and a crop recommendation selector will live here.", icon: Leaf, next: "Soil type reference data arrives in a later build phase." },
  "/community/discussion-forum": { eyebrow: "COMMUNITY", title: "Discussion Forum", summary: "Submit an article, share a field note, and take part in farmer-to-farmer discussion.", icon: MessageCircle, next: "Forum persistence and interactions arrive in a later build phase." },
  "/community/sikayat-kendra": { eyebrow: "COMMUNITY", title: "Sikayat Kendra", summary: "A support route for farmer complaints, resolution tracking, and admin response workflows.", icon: ShieldCheck, next: "Complaint authentication and resolution workflows arrive in a later build phase." },
  "/community/community-events": { eyebrow: "COMMUNITY", title: "Community Events", summary: "Explore workshops, meetups, and local agricultural events, with multilingual community support.", icon: CalendarDays, next: "Event creation and persistence arrive in a later build phase." },
  "/resources": { eyebrow: "COMMUNITY", title: "Agricultural Resources", summary: "A curated set of practical resources for best practices, crop management, soil health, sustainable farming, equipment, and market trends.", icon: Leaf, next: "Resource content will be expanded from the approved reference module." },
};

function PlaceholderPage({ path }) {
  const detail = pageDetails[path] || pageDetails["/guide"];
  const Icon = detail.icon;
  return (
    <PageFrame footer={path.startsWith("/guide") || ["/planner", "/weather", "/disease-detection", "/animal-intrusion", "/soil-analysis"].includes(path) ? "agricultural" : "community"}>
      <section className="placeholder-page">
        <div className="content-width placeholder-grid">
          <div className="placeholder-copy">
            <p className="eyebrow">{detail.eyebrow}</p>
            <h1>{detail.title}</h1>
            <p className="placeholder-summary">{detail.summary}</p>
            <div className="notice-card"><span className="notice-icon"><Icon size={20} /></span><div><strong>Phase 1 route is ready</strong><p>{detail.next}</p></div></div>
            {detail.links && <div className="guide-links">{detail.links.map((link) => <Link key={link.href} href={link.href} className="guide-link">{link.label}<ArrowRight size={15} /></Link>)}</div>}
            <Link href="/" className="text-link">Return to the agricultural hub <ArrowRight size={16} /></Link>
          </div>
          <aside className="placeholder-aside"><div className="aside-mark"><Icon size={44} /></div><p className="eyebrow">UP NEXT</p><h2>One clear step at a time.</h2><p>We are keeping this route honest until its real data or service workflow is implemented.</p></aside>
        </div>
      </section>
    </PageFrame>
  );
}

function CommunityHome() {
  return (
    <PageFrame>
      <section className="community-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 26, 18, .74), rgba(5, 26, 18, .24)), url(${heroImage})` }}>
        <div className="content-width community-hero-content"><p className="eyebrow eyebrow--light">COMMUNITY / KRISHAK</p><h1>Welcome to the Farmer Community</h1><p>Connect with fellow farmers, share knowledge, and stay close to the latest agricultural conversations.</p><Link href="/community/discussion-forum" className="button button--ochre">Explore the community <ArrowRight size={16} /></Link></div>
      </section>
      <section className="community-intro content-width"><p className="eyebrow">A SHARED FIELD NOTEBOOK</p><h2>Three ways to take part.</h2><div className="community-links"><Link href="/community/discussion-forum"><MessageCircle size={22} /><strong>Discussion Forums</strong><span>Share a question, article, or field note.</span></Link><Link href="/community/sikayat-kendra"><ShieldCheck size={22} /><strong>Sikayat Kendra</strong><span>Submit and follow an agricultural complaint.</span></Link><Link href="/community/community-events"><CalendarDays size={22} /><strong>Community Events</strong><span>Find workshops, meetups, and local activity.</span></Link></div></section>
    </PageFrame>
  );
}

const fertilizerData = [
  { name: "Balanced NPK 10-10-10", crop: "All crops", soil: "Loamy", n: 10, p: 10, k: 10, description: "A balanced base feed for general crop establishment." },
  { name: "NitroGrow 20", crop: "Wheat", soil: "Silty", n: 20, p: 5, k: 5, description: "A nitrogen-forward blend for leafy crop growth." },
  { name: "RootRise 12-24-12", crop: "Rice", soil: "Clayey", n: 12, p: 24, k: 12, description: "A phosphorus-forward blend for root and early growth." },
  { name: "FruitSet 8-12-24", crop: "Tomato", soil: "Sandy", n: 8, p: 12, k: 24, description: "A potassium-forward blend for fruiting stages." },
  { name: "SoilCare Organic", crop: "All crops", soil: "Black", n: 4, p: 3, k: 4, description: "A gentle organic option for gradual soil improvement." },
  { name: "Millet Support 14-8-16", crop: "Millet", soil: "Sandy", n: 14, p: 8, k: 16, description: "A measured blend for resilient cereal crops." },
];

const soilData = [
  { name: "Loamy Soil", type: "Loamy", ph: "6.0–7.0", tone: "loam", description: "Balanced sand, silt, clay, and organic matter. Often easy to work and well-suited to diverse crops." },
  { name: "Clayey Soil", type: "Clayey", ph: "6.0–7.5", tone: "clay", description: "Fine particles hold water and nutrients well, but need careful drainage and aeration." },
  { name: "Sandy Soil", type: "Sandy", ph: "5.5–7.0", tone: "sand", description: "Light and fast-draining soil that benefits from organic matter and thoughtful irrigation." },
  { name: "Black Soil", type: "Black", ph: "6.5–8.0", tone: "black", description: "Deep, moisture-retaining soil commonly associated with cotton and other field crops." },
  { name: "Silty Soil", type: "Silty", ph: "6.0–7.5", tone: "silt", description: "Smooth, fertile soil that can support strong crop growth with erosion care." },
  { name: "Peaty Soil", type: "Peaty", ph: "4.5–6.0", tone: "peat", description: "Organic-rich soil that needs crop-specific pH and drainage attention." },
];

const cropOptions = ["Wheat", "Rice", "Maize", "Cotton", "Tomato", "Millet"];
const soilOptions = ["Loamy", "Clayey", "Sandy", "Black", "Silty", "Peaty"];

function FilterBar({ soil, crop, setSoil, setCrop }) {
  return <div className="filter-bar">
    <label>Soil type<select value={soil} onChange={(event) => setSoil(event.target.value)}><option value="All">All soil types</option>{soilOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>Crop type<select value={crop} onChange={(event) => setCrop(event.target.value)}><option value="All">All crop types</option>{cropOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
  </div>;
}

function GuideIndexPage() {
  return <PageFrame footer="agricultural"><section className="guide-index-page"><div className="content-width guide-index-head"><div><p className="eyebrow">FIELD GUIDE</p><h1>Farmer's Guide</h1><p className="page-lead">Practical reference tools for soil, seed, fertilizer, and crop choices. Start with the question closest to the field today.</p></div><div className="guide-index-note"><Leaf size={22}/><strong>Reference first.</strong><span>Use the guide to build context before choosing an action.</span></div></div><div className="content-width guide-tool-grid">{[{href:"/guide/soil-testing", label:"Soil Testing", copy:"Learn how to collect a soil sample and read key nutrient context.", icon:Droplets},{href:"/guide/hybrid-seed", label:"Hybrid Seed", copy:"Browse seed options by soil and crop type.", icon:Sprout},{href:"/guide/fertilizers", label:"Fertilizers", copy:"Compare fertilizer blends and N/P/K composition.", icon:Sprout},{href:"/guide/soil-types", label:"Soil Types", copy:"Understand soil profiles and crop recommendations.", icon:Leaf}].map(({href,label,copy,icon:Icon}, index)=><Link className="guide-tool-card" href={href} key={href}><span className="card-index">0{index+1}</span><Icon size={25}/><h2>{label}</h2><p>{copy}</p><span className="card-action">Open tool <ArrowRight size={15}/></span></Link>)}</div><div className="content-width guide-crop-link"><Link href="/guide/crop-recommendation" className="guide-link">Open Crop Recommendation <ArrowRight size={15}/></Link></div></section></PageFrame>;
}

function SoilTestingPage() {
  const { t } = useLanguage();
  const [soil, setSoil] = useState("");
  const [crop, setCrop] = useState("");
  const [savedContext, setSavedContext] = useState(null);
  const [contextMessage, setContextMessage] = useState("");
  const [motionReduced, setMotionReduced] = useState(() => reducedMotion());
  useEffect(() => { const media = window.matchMedia?.("(prefers-reduced-motion: reduce)"); if (!media) return undefined; const update = () => setMotionReduced(media.matches); media.addEventListener?.("change", update); return () => media.removeEventListener?.("change", update); }, []);
  useEffect(() => { setSavedContext((current) => current && (current.soil !== soil || current.crop !== crop) ? null : current); }, [soil, crop]);
  const saveContext = () => { if (!soil || !crop) { setSavedContext(null); setContextMessage(t("Select both soil type and crop type before saving.")); return; } setSavedContext({ soil, crop }); setContextMessage(""); };
  const fertilizerRecommendation = soil && crop ? fertilizerData.find((item) => item.soil === soil && (item.crop === crop || item.crop === "All crops")) || null : null;
  const nutrientValues = fertilizerRecommendation ? [{ name: "Nitrogen (N)", value: fertilizerRecommendation.n }, { name: "Phosphorus (P)", value: fertilizerRecommendation.p }, { name: "Potassium (K)", value: fertilizerRecommendation.k }] : [];
  const nutrientMax = chartMax(nutrientValues);
  const resources = [{ title: "Soil Test Laboratory", href: "https://www.soiltestlab.com/", description: "Comprehensive soil testing services." }, { title: "Agricultural Soil Testing Guidelines", href: "https://soilhealth.dac.gov.in/", description: "Official guidelines for soil testing." }, { title: "Fertilizer Recommendations", href: "https://www.fertilizer.org/", description: "Information on fertilizer application based on soil and crop types." }];
  return <PageFrame footer="agricultural"><section className="guide-detail-page soil-testing-compact soil-testing-simple"><div className="content-width guide-detail-head"><div><p className="eyebrow">{t("FIELD GUIDE / SOIL TESTING")}</p><h1>{t("Know the soil before the season starts.")}</h1><p className="page-lead">{t("Select a soil type and crop type to view the existing local fertilizer reference.")}</p></div><div className="guide-stat"><span>{t("Reference recommendation")}</span><strong>{t("N / P / K")}</strong><small>{t("Not a laboratory soil test.")}</small></div></div><div className="content-width soil-testing-flow"><section className="soil-compact-panel soil-context-panel"><div className="soil-compact-heading"><div><p className="section-kicker">{t("01 / INTERACTIVE TOOLS")}</p><h2>{t("Interactive Tools")}</h2></div><span className="soil-step-mark">{t("Soil + Crop")}</span></div><div className="filter-bar"><label htmlFor="soil-reference-type">{t("Select Soil Type")}<select id="soil-reference-type" value={soil} onChange={(event) => { setSoil(event.target.value); setContextMessage(""); }}><option value="" disabled>{t("Select soil type")}</option>{soilOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label htmlFor="crop-reference-type">{t("Select Crop Type")}<select id="crop-reference-type" value={crop} onChange={(event) => { setCrop(event.target.value); setContextMessage(""); }}><option value="" disabled>{t("Select crop type")}</option>{cropOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="button button--leaf" type="button" onClick={saveContext}><Check size={16}/> {t("Save sample context")}</button>{contextMessage && <p className="form-error" role="alert">{contextMessage}</p>}{savedContext && <div className="inline-success">{t("Context saved for this session:")} {savedContext.soil} / {savedContext.crop}.</div>}</section><section className="soil-compact-panel soil-analysis-panel"><div className="soil-compact-heading"><div><p className="section-kicker">{t("02 / RECOMMENDATION")}</p><h2>{t("Fertilizer Recommendations")}</h2></div><span className="soil-step-mark">{soil && crop ? `${soil} · ${crop}` : t("Select soil and crop")}</span></div><p className="soil-compact-lead">{t("Based on the selected soil and crop type.")}</p>{fertilizerRecommendation ? <><div className="soil-fertilizer-summary"><div className="soil-fertilizer-copy"><strong>{t(fertilizerRecommendation.name)}</strong><span>{t(fertilizerRecommendation.description)}</span><small>{t("Reference recommendation — not a laboratory soil test.")}</small></div><div className="soil-fertilizer-values" aria-label={t("Reference fertilizer composition")}><span><b>{fertilizerRecommendation.n}</b><small>N</small></span><span><b>{fertilizerRecommendation.p}</b><small>P</small></span><span><b>{fertilizerRecommendation.k}</b><small>K</small></span></div></div></> : <div className="empty-result soil-compact-empty"><Leaf size={21}/><div><strong>{soil && crop ? t("No verified fertilizer recommendation is available for this soil and crop combination.") : t("Select soil type and crop type to view a reference recommendation.")}</strong><p>{t("No location, map, year, or photo is required for this reference flow.")}</p></div></div>}</section><section className="soil-compact-panel soil-reference-panel soil-primary-nutrients"><div className="soil-compact-heading"><div><p className="section-kicker">{t("03 / NUTRIENTS")}</p><h2>{t("Nutrient Levels Chart")}</h2></div><span className="soil-step-mark">{t("Reference composition")}</span></div>{fertilizerRecommendation ? <><p className="soil-compact-lead">{t("The chart uses the same N/P/K values shown in the selected fertilizer recommendation.")}</p><div className="npk-chart" role="group" aria-label={t("Reference fertilizer composition chart")}><div className="npk-chart-label">{t("N/P/K reference composition")}</div>{nutrientValues.map((item, index) => <div className="npk-chart-row" key={item.name}><span className="npk-chart-name">{t(item.name)}</span><div className="npk-chart-track"><div className={"npk-chart-bar" + (motionReduced ? "" : " npk-chart-bar--animated")} style={{ width: chartWidth(item.value, nutrientMax), ...chartAnimationStyle(index, motionReduced) }} title={`${t(item.name)}: ${item.value}`} tabIndex={0} aria-label={`${t(item.name)}: ${item.value}`}><strong>{item.value}</strong><small>{t("N/P/K")}</small></div></div></div>)}<div className="npk-chart-scale" aria-hidden="true"><span>0</span><span>{(nutrientMax / 2).toLocaleString()}</span><span>{nutrientMax.toLocaleString()}</span></div></div><p className="npk-disclaimer">{t("These values describe the existing local fertilizer reference composition. They are not measured soil nutrient concentrations and have no physical unit.")}</p></> : <div className="empty-result soil-compact-empty"><Droplets size={23}/><div><strong>{t("Nutrient chart unavailable until a reference recommendation is available.")}</strong><p>{t("Select both soil type and crop type. No location or external Soil Health Card lookup is required.")}</p></div></div>}</section><section className="soil-compact-panel soil-resources-panel"><div className="soil-compact-heading"><div><p className="section-kicker">{t("04 / RESOURCES & SUPPORT")}</p><h2>{t("Resources & Support")}</h2></div></div><p>{t("Explore these helpful resources for soil testing, interpreting results, and making informed fertilizer decisions:")}</p><div className="resource-grid">{resources.map((resource) => <a className="resource-card" href={resource.href} target="_blank" rel="noopener noreferrer" key={resource.href}><Leaf size={23}/><h2>{t(resource.title)}</h2><p>{t(resource.description)}</p><span className="text-link">{t("Open resource")} <ArrowRight size={15}/></span></a>)}</div></section></div></section></PageFrame>;
}

function LegacySoilTestingPage() {
  const { t } = useLanguage();
  const [soil, setSoil] = useState("");
  const [crop, setCrop] = useState("");
  const [savedContext, setSavedContext] = useState(null);
  const [contextMessage, setContextMessage] = useState("");
  const [location, setLocation] = useState({ state: "", stateCode: "", district: "", districtCode: "", block: "", blockCode: "", village: "", villageCode: "", year: "", yearCode: "" });
  const [referenceOptions, setReferenceOptions] = useState({ state: [], district: [], block: [], village: [], year: [] });
  const [optionError, setOptionError] = useState("");
  const [locationState, setLocationState] = useState({ status: "idle", coordinates: null, message: "" });
  const [mapOpen, setMapOpen] = useState(false);
  const [photo, setPhoto] = useState(resetPhotoState());
  const [soilTest, setSoilTest] = useState({ status: "idle", result: null, source: null, sourceUrl: null, coverage: null, metadata: null, message: "" });
  const optionRequests = useRef({});
  const optionRequestGuard = useRef(createSoilTestRequestGuard());
  const referenceRequest = useRef(null);
  const photoInputRef = useRef(null);
  const [motionReduced, setMotionReduced] = useState(() => reducedMotion());
  const locationSelect = (key, label, placeholder, parent) => <label>{label}<select value={location[key + "Code"] || location[key]} onChange={(event) => updateLocation(key, event.target.value)} disabled={Boolean(parent && !location[parent])}><option value="">{placeholder}</option>{referenceOptions[key].map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>;
  const loadOptions = async (level, filters) => {
    optionRequests.current[level]?.abort();
    const controller = new AbortController();
    const requestId = optionRequestGuard.current.next(level);
    optionRequests.current[level] = controller;
    try {
      setOptionError("");
      const options = await getSoilReferenceOptions(level, filters, controller.signal);
      if (!optionRequestGuard.current.isCurrent(level, requestId)) return;
      setReferenceOptions((current) => ({ ...current, [level]: options }));
      if (level === "year") {
        const latest = chooseLatestSoilYear(options);
        if (latest) setLocation((current) => current.village === filters.village ? { ...current, year: latest, yearCode: latest } : current);
      }
    } catch (error) {
      if (error?.name === "AbortError" || !optionRequestGuard.current.isCurrent(level, requestId)) return;
      setOptionError(error.message);
    } finally { if (optionRequests.current[level] === controller) delete optionRequests.current[level]; }
  };
  useEffect(() => { loadOptions("state", {}); return () => Object.values(optionRequests.current).forEach((controller) => controller.abort()); }, []);
  useEffect(() => { if (location.state) loadOptions("district", { state: location.state, state_code: location.stateCode }); }, [location.state, location.stateCode]);
  useEffect(() => { if (location.state && location.district) loadOptions("block", { state: location.state, state_code: location.stateCode, district: location.district, district_code: location.districtCode }); }, [location.state, location.stateCode, location.district, location.districtCode]);
  useEffect(() => { if (location.state && location.district && location.block) loadOptions("village", { state: location.state, state_code: location.stateCode, district: location.district, district_code: location.districtCode, block: location.block, block_code: location.blockCode }); }, [location.state, location.stateCode, location.district, location.districtCode, location.block, location.blockCode]);
  useEffect(() => { if (location.state && location.district && location.block && location.village) loadOptions("year", { state: location.state, state_code: location.stateCode, district: location.district, district_code: location.districtCode, block: location.block, block_code: location.blockCode, village: location.village, village_code: location.villageCode }); }, [location.state, location.stateCode, location.district, location.districtCode, location.block, location.blockCode, location.village, location.villageCode]);
  useEffect(() => { const media = window.matchMedia?.("(prefers-reduced-motion: reduce)"); if (!media) return undefined; const update = () => setMotionReduced(media.matches); media.addEventListener?.("change", update); return () => media.removeEventListener?.("change", update); }, []);
  useEffect(() => () => { if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl); }, [photo.previewUrl]);
  const updateLocation = (key, value) => {
    const selected = referenceOptions[key].map(normalizeReferenceOption).find((item) => item?.value === value) || { value, label: value };
    const { location: next, options: clearedOptions } = resetSoilTestCascade(location, referenceOptions, key, selected.label, selected.value);
    (SOIL_TEST_DOWNSTREAM[key] || []).forEach((child) => { optionRequests.current[child]?.abort(); optionRequestGuard.current.invalidate(child); });
    referenceRequest.current?.abort(); setReferenceOptions(clearedOptions); setLocation(next); setSoilTest({ status: "idle", result: null, source: null, sourceUrl: null, coverage: null, metadata: null, message: "" });
  };
  const applyMatchedLocation = (matched, coordinates) => {
    if (!matched?.matched || !matched.location?.village) { setLocationState({ status: "partial", coordinates, message: matched?.message || "Unable to match this location to a Soil Health Card reference village. Please select your location manually." }); return; }
    setLocationState({ status: "success", coordinates, message: "" }); setReferenceOptions({ state: [], district: [], block: [], village: [], year: [] }); setLocation({ state: matched.location.state || "", stateCode: matched.location.stateCode || "", district: matched.location.district || "", districtCode: matched.location.districtCode || "", block: matched.location.block || "", blockCode: matched.location.blockCode || "", village: matched.location.village || "", villageCode: matched.location.villageCode || "", year: "", yearCode: "" });
  };
  const resolveCoordinates = async (coordinates) => {
    const safe = normalizeCoordinates(coordinates?.lat, coordinates?.lng);
    if (!safe) { setLocationState({ status: "error", coordinates: null, message: "Selected coordinates are invalid." }); return; }
    setLocationState({ status: "loading", coordinates: safe, message: "Resolving your location…" });
    try { applyMatchedLocation(await reverseGeocodeSoilLocation(safe.lat, safe.lng), safe); } catch (error) { setLocationState({ status: "error", coordinates: safe, message: error.message }); }
  };
  const useMyLocation = () => {
    void loadMapScript().catch(() => undefined);
    if (!navigator.geolocation) { setLocationState({ status: "error", coordinates: null, message: "Your location is unavailable. You can select your area manually." }); return; }
    setLocationState({ status: "loading", coordinates: null, message: "Resolving your location…" });
    navigator.geolocation.getCurrentPosition(({ coords }) => resolveCoordinates({ lat: coords.latitude, lng: coords.longitude }), (error) => setLocationState({ status: "error", coordinates: null, message: geolocationErrorMessage(error) }), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };
  const loadReferenceData = async () => {
    if (Object.values(location).some((value) => !value)) { setSoilTest({ status: "no_result", result: null, source: null, sourceUrl: null, coverage: null, metadata: null, message: "Select a state, district, block, village, and year before loading reference data." }); return; }
    referenceRequest.current?.abort(); const controller = new AbortController(); referenceRequest.current = controller; setSoilTest({ status: "loading", result: null, source: null, sourceUrl: null, coverage: null, metadata: null, message: "" });
    try { setSoilTest(await getSoilTest(location, controller.signal)); } catch (error) { if (error?.name === "AbortError") return; setSoilTest({ status: "error", result: null, source: null, sourceUrl: null, coverage: null, metadata: null, message: error.message }); } finally { if (referenceRequest.current === controller) referenceRequest.current = null; }
  };
  const handlePhoto = async (event) => {
    const file = event.target.files?.[0]; if (!file) return; if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl); const previewUrl = URL.createObjectURL(file); setPhoto({ status: "loading", previewUrl, observation: null, message: "Reviewing the photo locally…" }); const result = await analyzeSoilPhoto(file); setPhoto({ status: result.status, previewUrl, observation: result.observation || null, message: result.message || "" }); event.target.value = "";
  };
  const removePhoto = () => { if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl); setPhoto(resetPhotoState()); };
  const saveContext = () => { if (!soil || !crop) { setSavedContext(null); setContextMessage("Select both soil type and crop type before saving."); return; } setSavedContext({ soil, crop }); setContextMessage(""); };
  const referenceMeasurements = soilTest.result?.nutrients || [];
  const referenceMax = chartMax(referenceMeasurements);
  const selectedLocation = sourceLocationSummary(location);
  const selectedYear = soilTest.result?.year || location.year;
  const fertilizerRecommendation = soil && crop ? fertilizerData.find((item) => (item.soil === soil || item.soil === "Black" && soil === "All") && (item.crop === crop || item.crop === "All crops")) || null : null;
  const resources = [{ title: "Soil Test Laboratory", href: "https://www.soiltestlab.com/", description: "Comprehensive soil testing services." }, { title: "Agricultural Soil Testing Guidelines", href: "https://soilhealth.dac.gov.in/", description: "Official guidelines for soil testing." }, { title: "Fertilizer Recommendations", href: "https://www.fertilizer.org/", description: "Information on fertilizer application based on soil and crop types." }];
  return <PageFrame footer="agricultural"><section className="guide-detail-page soil-testing-compact"><div className="content-width guide-detail-head"><div><p className="eyebrow">{t("FIELD GUIDE / SOIL TESTING")}</p><h1>{t("Know the soil before the season starts.")}</h1><p className="page-lead">{t("Choose a field context, optionally locate the reference area, and keep the source-backed chart in view.")}</p></div><div className="guide-stat"><span>{t("Reference chart")}</span><strong>{t("N / P / K")}</strong><small>{t("Village-level reference data; not the farmer’s personal Soil Health Card result.")}</small></div></div><div className="content-width soil-testing-flow"><section className="soil-compact-panel soil-context-panel"><div className="soil-compact-heading"><div><p className="section-kicker">01 / CONTEXT</p><h2>{t("Set the field context")}</h2></div><span className="soil-step-mark">{t("Optional until you save")}</span></div><div className="filter-bar"><label>{t("Soil type")}<select value={soil} onChange={(event) => { setSoil(event.target.value); setContextMessage(""); }}><option value="" disabled>{t("Select soil type")}</option>{soilOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>{t("Crop type")}<select value={crop} onChange={(event) => { setCrop(event.target.value); setContextMessage(""); }}><option value="" disabled>{t("Select crop type")}</option>{cropOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="button button--leaf" type="button" onClick={saveContext}><Check size={16}/> {t("Save sample context")}</button>{contextMessage && <p className="form-error" role="alert">{contextMessage}</p>}{savedContext && <div className="inline-success">Context saved for this session: {savedContext.soil} / {savedContext.crop}.</div>}</section><section className="soil-compact-panel soil-location-panel"><div className="soil-compact-heading"><div><p className="section-kicker">02 / LOCATION</p><h2>Find a verified reference area</h2></div><span className="soil-step-mark">{t("Optional")}</span></div><div className="soil-location-actions"><button type="button" className="button button--leaf" onClick={useMyLocation}><LocateFixed size={16}/> {t("Use My Location")}</button><button type="button" className="button button--quiet" onClick={() => setMapOpen(true)}>{t("Select Location")}</button><button type="button" className="button button--quiet" onClick={() => document.getElementById("soil-manual-location")?.scrollIntoView({ behavior: motionReduced ? "auto" : "smooth", block: "center" })}>{t("Select Manually")}</button><button type="button" className="button button--quiet" onClick={() => photoInputRef.current?.click()}><Camera size={16}/> {t("Upload Soil / Land Photo")}</button></div><input ref={photoInputRef} id="soil-photo-input" className="visually-hidden" type="file" accept={PHOTO_ACCEPT} capture={PHOTO_CAPTURE} onChange={handlePhoto}/>{selectedLocation && <div className="soil-location-summary"><span>{t("Location")}</span><strong>{selectedLocation}</strong>{selectedYear && <small>{t("Reference year")}: {selectedYear}</small>}</div>}{locationState.status === "loading" && <div className="service-state" role="status"><span className="loading-dot"/><div><strong>{t("Resolving your location…")}</strong></div></div>}{locationState.message && locationState.status !== "loading" && <p className="form-error" role="alert">{locationState.message}</p>}<p className="soil-privacy-note">{t("Precise coordinates are used only for this session’s lookup and are not stored in public links.")}</p>{mapOpen && <SoilLocationPicker initialCoordinates={locationState.coordinates || null} onConfirm={(coordinates) => { setMapOpen(false); resolveCoordinates(coordinates); }} onClose={() => setMapOpen(false)} t={t}/>}</section><details className="soil-manual-details" id="soil-manual-location"><summary>{t("Manual location selectors")}</summary><div className="filter-bar">{locationSelect("state", "State", "Select state")}{locationSelect("district", "District", "Select district", "state")}{locationSelect("block", "Block / Tehsil", "Select block / tehsil", "district")}{locationSelect("village", "Village", "Select village", "block")}{locationSelect("year", "Year", "Select year", "village")}</div>{location.year && <p className="latest-year-note">{t("Latest available reference year:")} {location.year}</p>}{optionError && <p className="form-error" role="alert">{optionError}</p>}<button className="button button--leaf" type="button" onClick={loadReferenceData}>{t("Load reference data")} <ArrowRight size={15}/></button></details><section className="soil-compact-panel soil-analysis-panel"><div className="soil-compact-heading"><div><p className="section-kicker">03 / ANALYSIS</p><h2>{t("Fertilizer Recommendations")}</h2></div><span className="soil-step-mark">{soil && crop ? `${soil} · ${crop}` : t("Select field context")}</span></div><p className="soil-compact-lead">{t("Based on the selected soil and crop")}</p>{fertilizerRecommendation ? <div className="soil-fertilizer-summary"><div className="soil-fertilizer-copy"><strong>{fertilizerRecommendation.name}</strong><span>{fertilizerRecommendation.description}</span><small>{t("Catalogue composition")}</small></div><div className="soil-fertilizer-values"><span><b>{fertilizerRecommendation.n}</b><small>N</small></span><span><b>{fertilizerRecommendation.p}</b><small>P</small></span><span><b>{fertilizerRecommendation.k}</b><small>K</small></span></div></div> : <div className="empty-result soil-compact-empty"><Leaf size={21}/><div><strong>{t("No verified fertilizer recommendation is available for this soil and crop combination.")}</strong><p>{t("Select both soil type and crop type to see the existing local reference rule.")}</p></div></div>}</section><section className="soil-compact-panel soil-reference-panel"><div className="soil-compact-heading"><div><p className="section-kicker">04 / REFERENCE</p><h2>{t("Nutrient Levels Chart")}</h2></div>{selectedLocation && <span className="soil-step-mark">{t("Soil Health Card reference data")}</span>}</div>{!selectedLocation && !photo.observation && <div className="empty-result soil-compact-empty"><Droplets size={23}/><div><strong>{t("Select a location or upload a soil photo to begin.")}</strong><p>{t("Location-based reference data and photo observations are separate, optional flows.")}</p></div></div>}{photo.observation && !selectedLocation && <div className="empty-result soil-compact-empty"><Droplets size={23}/><div><strong>{t("Select your location to view Soil Health Card reference data.")}</strong><p>{t("No chemical nutrient values are inferred from this photo.")}</p></div></div>}{soilTest.status === "loading" && <div className="service-state" role="status"><span className="loading-dot"/><div><strong>Loading Soil Health Card reference data…</strong></div></div>}{soilTest.status === "error" && <div className="service-state service-state--error" role="alert"><X size={22}/><div><strong>Soil Health Card reference data is temporarily unavailable.</strong><p>{soilTest.message}</p></div></div>}{soilTest.status === "no_result" && <div className="empty-result soil-compact-empty"><Droplets size={23}/><div><strong>No Soil Health Card reference data is available for this selection.</strong><p>{soilTest.message}</p></div></div>}{soilTest.status === "success" && soilTest.result && <div className="npk-result" aria-live="polite"> <div className="soil-reference-meta"><div><span>{t("Location")}</span><strong>{selectedLocation}</strong></div><div><span>{t("Reference year")}</span><strong>{selectedYear}</strong></div><div><span>{t("Source")}</span><strong>{t("Soil Health Card reference data")}</strong></div></div><div className="soil-freshness"><p><strong>{t("Data coverage:")}</strong> {soilTest.coverage || t("Not specified by live metadata")}</p><p><strong>{t("Last updated:")}</strong> {soilTest.metadata?.updatedAt || t("Not specified by live metadata")}</p><p><strong>{t("Reference level:")}</strong> {soilTest.metadata?.granularity === "Village" ? t("Village-level reference data") : soilTest.metadata?.granularity || t("Not specified by live metadata")}</p>{soilTest.metadata?.license && <p><strong>{t("License")}</strong> {soilTest.metadata.license}</p>}<a href={soilTest.sourceUrl || undefined} target="_blank" rel="noopener noreferrer">{t("India Data Portal source")}</a></div><div className="npk-chart" role="group" aria-label={"Observed nutrient category counts for " + selectedLocation + ", " + selectedYear}><div className="npk-chart-label">{t("Nutrient Levels Chart")}</div>{referenceMeasurements.map((item, index) => <div className="npk-chart-row" key={item.name + "-" + item.level + "-" + index}><span className="npk-chart-name">{item.name}{item.level ? " · " + item.level : ""}</span><div className="npk-chart-track"><div className={"npk-chart-bar" + (motionReduced ? "" : " npk-chart-bar--animated")} style={{ width: chartWidth(item.value, referenceMax), ...chartAnimationStyle(index, motionReduced) }} title={chartTooltip(item, location, selectedYear)} tabIndex={0} aria-label={chartTooltip(item, location, selectedYear)}><strong>{item.value}</strong><small>{item.unit || t("Source unit unavailable")}</small></div></div></div>)}<div className="npk-chart-scale" aria-hidden="true"><span>0</span><span>{(referenceMax / 2).toLocaleString()}</span><span>{referenceMax.toLocaleString()}</span></div><p className="npk-chart-help">{t("Hover, focus, or tap a bar to inspect the source value.")} {motionReduced ? t("Animation is reduced for accessibility.") : ""}</p></div><p className="npk-disclaimer">{t("Village-level reference data; not the farmer’s personal Soil Health Card result.")} {t("Values preserve the source’s Number/Count semantics; no physical nutrient unit is supplied by the dataset.")}</p></div>}</section>{photo.previewUrl && <section className="soil-compact-panel soil-photo-section"><div className="soil-compact-heading"><div><p className="section-kicker">05 / PHOTO</p><h2>{t("Visual Soil Observation")}</h2></div><span className="soil-step-mark">{t("Optional")}</span></div><p className="soil-compact-lead">{t("Visible surface characteristics only; no chemical measurements are inferred.")}</p><div className="soil-photo-actions">{photo.previewUrl && <><button type="button" className="button button--quiet" onClick={() => photoInputRef.current?.click()}>{t("Change photo")}</button><button type="button" className="button button--quiet" onClick={removePhoto}>{t("Remove photo")}</button></>}</div><p className="soil-photo-help">{t("JPG, JPEG, or PNG. Camera capture is available where your browser supports it.")}</p>{photo.previewUrl && <div className="soil-photo-preview"><img src={photo.previewUrl} alt="Uploaded land or soil photo preview"/><div><strong>{photo.status === "loading" ? t("Reviewing the photo locally…") : photo.status === "error" ? t("Photo needs attention") : t("Photo ready for visual observation.")}</strong>{photo.message && <p className="form-error" role="alert">{photo.message}</p>}{photo.observation && <div className="soil-observation-card"><p><strong>{t("Visual observation:")}</strong> {t("The image appears")} {photo.observation.color} {t("in the sampled browser preview.")}</p><p>{photo.observation.framing}</p><p>{photo.observation.limitation}</p><p>{t("No chemical nutrient values are inferred from this photo.")}</p></div>}</div></div>}<p className="soil-privacy-note">{t("The photo stays in this browser session and is not uploaded to an AI service. Precise coordinates are used only for this session’s lookup and are not stored in public links.")}</p>{photo.observation && <div className="soil-observation-card soil-observation-card--compact"><strong>{t("Visual Soil Observation")}</strong><span>{t("Photo-based visible characteristics.")}</span></div>}</section>}<section className="soil-compact-panel soil-resources-panel"><div className="soil-compact-heading"><div><p className="section-kicker">{t("06 / RESOURCES & SUPPORT")}</p><h2>{t("Resources & Support")}</h2></div></div><p>{t("Explore these helpful resources for soil testing, interpreting results, and making informed fertilizer decisions:")}</p><div className="resource-grid">{resources.map((resource) => <a className="resource-card" href={resource.href} target="_blank" rel="noopener noreferrer" key={resource.href}><Leaf size={23}/><h2>{t(resource.title)}</h2><p>{t(resource.description)}</p><span className="text-link">{t("Open resource")} <ArrowRight size={15}/></span></a>)}</div></section><aside className="guide-sidebar soil-compact-sidebar"><p className="eyebrow">{t("GOOD TO NOTE")}</p><h2>{t("Keep the sample traceable.")}</h2><p>{t("Record the field, crop, collection date, and test source alongside every result.")}</p><p className="soil-sidebar-note">{t("A photo can support visual notes, but only a laboratory test or personal Soil Health Card can establish measured soil chemistry.")}</p><Link href="/guide/soil-types" className="text-link">{t("Explore soil types")} <ArrowRight size={16}/></Link></aside></div></section></PageFrame>;
}
function HybridSeedPage() {
  const [soil, setSoil] = useState("All"); const [crop, setCrop] = useState("All");
  const results = filterReferenceSeeds({ soil, crop });
  return <PageFrame footer="agricultural"><section className="catalogue-page"><div className="content-width catalogue-head"><div><p className="eyebrow">FIELD GUIDE / REFERENCE SEED CATALOGUE</p><h1>Hybrid Seed Reference Catalogue</h1><p className="page-lead">This catalogue helps filter reference seed entries by crop and soil type. It is not an AI recommendation, verified commercial catalogue, or purchase instruction.</p></div><div className="catalogue-count"><strong>{results.length}</strong><span>visible entries</span></div></div><div className="content-width"><FilterBar soil={soil} crop={crop} setSoil={setSoil} setCrop={setCrop}/><p className="reference-filter-note">Catalogue filtering uses only the stored crop and soil fields shown below.</p><div className="catalogue-grid">{results.map((item) => <article className="catalogue-card" key={item.id}><div className="catalogue-art catalogue-art--seed"><Sprout size={34}/></div><p className="eyebrow">{item.season || "Season unavailable"}</p><h2>{item.name}</h2><p>{item.description}</p><p className="reference-provenance"><strong>Source:</strong> {item.source}</p><p className="reference-limit"><strong>Limitation:</strong> {item.limitations}</p><div className="catalogue-meta"><span>Crop <b>{item.crop}</b></span><span>Soil <b>{item.soilTypes.join(", ")}</b></span><span>Status <b>Reference/demo</b></span></div></article>)}</div>{results.length === 0 && <div className="empty-result empty-result--wide"><Sprout size={24}/><div><strong>No reference seed entries match the selected crop and soil type.</strong><p>Try another soil or crop type. No seed entry has been invented for this filter combination.</p></div></div>}</div></section></PageFrame>;
}

function FertilizersPage() {
  const [soil, setSoil] = useState("All"); const [crop, setCrop] = useState("All");
  const results = fertilizerData.filter((item) => (soil === "All" || item.soil === soil || item.soil === "Black" && soil === "All") && (crop === "All" || item.crop === crop || item.crop === "All"));
  return <PageFrame footer="agricultural"><section className="catalogue-page"><div className="content-width catalogue-head"><div><p className="eyebrow">FIELD GUIDE / FERTILIZERS</p><h1>Compare the blend, not just the bag.</h1><p className="page-lead">Filter by field context and compare the nitrogen, phosphorus, and potassium composition recorded in each catalogue entry.</p></div><div className="catalogue-count"><strong>{results.length}</strong><span>visible entries</span></div></div><div className="content-width"><FilterBar soil={soil} crop={crop} setSoil={setSoil} setCrop={setCrop}/><div className="catalogue-grid">{results.map((item) => <article className="catalogue-card" key={item.name}><div className="catalogue-art catalogue-art--fertilizer"><Leaf size={34}/></div><p className="eyebrow">{item.crop}</p><h2>{item.name}</h2><p>{item.description}</p><div className="npk-row"><span><b>{item.n}</b>N</span><span><b>{item.p}</b>P</span><span><b>{item.k}</b>K</span></div><div className="catalogue-meta"><span>Soil <b>{item.soil}</b></span></div></article>)}</div>{results.length === 0 && <div className="empty-result empty-result--wide"><Leaf size={24}/><div><strong>No fertilizer entries match those filters.</strong><p>Try another soil or crop type.</p></div></div>}</div></section></PageFrame>;
}

function SoilTypesPage() {
  const [soil, setSoil] = useState("Loamy"); const [crop, setCrop] = useState("Wheat");
  const recommendations = { Loamy: { Wheat: "Wheat", Rice: "Vegetables", Maize: "Maize" }, Clayey: { Rice: "Rice", Wheat: "Wheat", Maize: "Rice" }, Sandy: { Millet: "Millet", Maize: "Maize", Tomato: "Groundnut" }, Black: { Cotton: "Cotton", Wheat: "Wheat", Maize: "Cotton" }, Silty: { Tomato: "Tomato", Wheat: "Wheat", Rice: "Vegetables" }, Peaty: { Rice: "Rice", Tomato: "Leafy vegetables", Wheat: "Review pH first" } };
  const recommendation = recommendations[soil]?.[crop] || "Review soil test context";
  return <PageFrame footer="agricultural"><section className="soil-types-page"><div className="content-width"><p className="eyebrow">FIELD GUIDE / SOIL TYPES</p><h1>Read the ground beneath the crop.</h1><p className="page-lead soil-lead">Soil texture, organic matter, water retention, and pH all shape the crops that can thrive.</p><div className="soil-card-grid">{soilData.map((item) => <article className={`soil-card soil-card--${item.tone}`} key={item.name}><div className="soil-card-visual"><span>{item.type.slice(0,2).toUpperCase()}</span></div><div><h2>{item.name}</h2><p>{item.description}</p><span className="ph-tag">pH {item.ph}</span></div></article>)}</div><section className="recommendation-panel"><div><p className="section-kicker">CROP RECOMMENDATION</p><h2>Start with the soil you have.</h2><p>Choose a soil and crop to see a deterministic reference pairing. This is a simple local rule set, not an AI prediction.</p></div><div className="recommendation-controls"><label>Soil type<select value={soil} onChange={(event) => setSoil(event.target.value)}>{soilOptions.map((item)=><option key={item}>{item}</option>)}</select></label><label>Crop type<select value={crop} onChange={(event) => setCrop(event.target.value)}>{cropOptions.map((item)=><option key={item}>{item}</option>)}</select></label><div className="recommendation-result"><span>Reference direction</span><strong>{recommendation}</strong></div></div></section></div></section></PageFrame>;
}

function IrrigationPlannerPage() {
const defaultForm = {
  crop: "Wheat",
  area: "1",
  soil: "Loamy",
  lastWatered: "",
  method: "Drip",
  location: "",
  latitude: null,
  longitude: null,
};
  const [form, setForm] = useState(defaultForm);
  const [plan, setPlan] = useState(null);
  const [aiState, setAiState] = useState({ status: "idle", action: "", why: "", caution: null }); // AI-assisted guidance
  const [weatherState, setWeatherState] = useState({ status: "empty", data: null, message: "" });
  const [tasks, setTasks] = useState(() => { try { const saved = JSON.parse(window.sessionStorage.getItem("krishak-planner-session-tasks") || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } });
  const [taskDraft, setTaskDraft] = useState({ title: "", dueDate: "", priority: "Low" });
  const [plannerMessage, setPlannerMessage] = useState("");
  const taskStorageKey = "krishak-planner-session-tasks";
  const skipTaskStorageWriteRef = useRef(false);
  const weatherRequestIdRef = useRef(0);
  useEffect(() => { if (skipTaskStorageWriteRef.current) { skipTaskStorageWriteRef.current = false; return; } try { window.sessionStorage.setItem(taskStorageKey, JSON.stringify(tasks)); } catch { /* Session persistence is optional browser storage. */ } }, [tasks]);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const updateLocation = (event) => {
    weatherRequestIdRef.current += 1;
    setForm((current) => ({ ...current, location: event.target.value, latitude: null, longitude: null }));
    setWeatherState({ status: "empty", data: null, message: "" });
  };
  const hasValidCoordinates = ({ latitude, longitude }) => Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  const loadWeather = async ({ latitude, longitude } = {}) => {
    if (latitude === undefined && !form.location.trim()) { setWeatherState({ status: "error", data: null, message: "Weather context unavailable — add/select a location for a weather-informed plan." }); return null; }
    const requestId = ++weatherRequestIdRef.current;
    setWeatherState({ status: "loading", data: null, message: "" });
    try {
      const data = latitude === undefined ? await getWeather(form.location.trim()) : await getWeatherForCoordinates(latitude, longitude);
      if (requestId !== weatherRequestIdRef.current) return null;
      setWeatherState({ status: "success", data, message: "" });
      return data;
    } catch (error) {
      if (requestId === weatherRequestIdRef.current) setWeatherState({ status: "error", data: null, message: error.message || "Weather data is temporarily unavailable. The planner can only provide a limited non-weather plan." });
      return null;
    }
  };
 
  const calculate = async (event) => {
    event.preventDefault();
    const validationError = validatePlannerInputs(form);
    if (validationError) { setPlan(null); setPlannerMessage(validationError); return; }
    setPlannerMessage("");
    const hasCoordinates = hasValidCoordinates(form);
    const weather = hasCoordinates ? await loadWeather({ latitude: form.latitude, longitude: form.longitude }) : form.location.trim() ? await loadWeather() : null;
    const nextPlan = buildIrrigationRecommendation(form, weather, { weatherUnavailable: Boolean((hasCoordinates || form.location.trim()) && !weather) });
    setPlan(nextPlan);
    // Fire AI explanation in background; fallback is silent.
    setAiState({ status: "loading", action: "", why: "", caution: null });
    fetch("/api/irrigation-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: nextPlan, weather, fieldInputs: form }) }).then(r => r.ok ? r.json() : Promise.reject(r)).then(ai => setAiState({ status: "ready", action: ai.action, why: ai.why, caution: ai.caution || null })).catch(() => setAiState({ status: "unavailable", action: "", why: "", caution: null }));
    setTaskDraft((current) => ({ ...current, priority: getPlannerTaskPriority(nextPlan.status) }));
  };
  const addTask = (event) => { event.preventDefault(); try { setTasks((items) => [...items, createPlannerTask(taskDraft)]); setTaskDraft({ title: "", dueDate: "", priority: getPlannerTaskPriority(plan?.status) }); setPlannerMessage(""); } catch (error) { setPlannerMessage(error.message); } };
  const resetPlanner = () => { weatherRequestIdRef.current += 1; setForm(defaultForm); setPlan(null); setWeatherState({ status: "empty", data: null, message: "" }); skipTaskStorageWriteRef.current = true; setTasks(() => []); setTaskDraft({ title: "", dueDate: "", priority: "Low" }); setPlannerMessage(""); try { window.sessionStorage.removeItem(taskStorageKey); } catch { /* Nothing to clear. */ } };
  const statusLabel = { [IRRIGATION_STATUS.WEATHER_DEPENDENT]: "Weather-dependent", [IRRIGATION_STATUS.INSUFFICIENT_DATA]: "Insufficient verified data", [IRRIGATION_STATUS.WAIT]: "Wait", [IRRIGATION_STATUS.IRRIGATE_NOW]: "Irrigate now" };
  return <PageFrame footer="agricultural"><section className="planner-page"><div className="content-width planner-head"><div><p className="eyebrow">FIELD TOOL / IRRIGATION PLANNER</p><h1>Plan the next watering with care.</h1><p className="page-lead">Use your field context with the existing real Weather service. This is a weather-informed planner, not an AI model or a substitute for local crop and soil measurements.</p></div><div className="planner-badge"><CloudSun size={27}/><span>WEATHER-INFORMED</span><strong>Explains missing data</strong></div></div><div className="content-width planner-layout"><form className="planner-form" onSubmit={calculate}><p className="section-kicker">01 / FIELD INPUTS</p><h2>Tell us about this plot.</h2><label>Crop<select value={form.crop} onChange={update("crop")}><option value="">Select crop</option>{cropOptions.map((item)=><option key={item}>{item}</option>)}</select></label><label>Plot area (acres)<input type="number" min="0" step="0.1" value={form.area} onChange={update("area")} /></label><label>Soil type<select value={form.soil} onChange={update("soil")}><option value="">Select soil type</option>{soilOptions.map((item)=><option key={item}>{item}</option>)}</select></label><label>Last watered<input type="date" value={form.lastWatered} onChange={update("lastWatered")} /></label><label>Irrigation method<select value={form.method} onChange={update("method")}><option value="">Select irrigation method</option><option>Drip</option><option>Sprinkler</option><option>Flood</option></select></label><div className="planner-location"><label>Weather location<input value={form.location} onChange={updateLocation} placeholder="Town, district, or village" /></label><div className="planner-location-actions"><button className="text-button" type="button" onClick={() => loadWeather()}><CloudSun size={15}/> Get weather context</button></div></div><div className="planner-actions"><button className="button button--leaf" type="submit"><Droplets size={16}/> Generate plan</button><button className="text-button" type="button" onClick={resetPlanner}>Reset planner</button></div>{plannerMessage && <p className="form-error" role="alert">{plannerMessage}</p>}</form><div className="planner-results"><section className="planner-result-card"><p className="section-kicker">02 / WEATHER CONTEXT</p>{weatherState.status === "empty" && <div className="empty-result"><CloudSun size={24}/><div><strong>Weather context unavailable</strong><p>Add a location to use weather-informed irrigation planning.</p></div></div>}{weatherState.status === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Loading weather context…</strong><p>Using the existing Krishak Weather service.</p></div></div>}{weatherState.status === "error" && <div className="service-state service-state--error"><X size={22}/><div><strong>Weather data is temporarily unavailable</strong><p>{weatherState.message}</p></div></div>}{weatherState.status === "success" && weatherState.data && <div className="planner-weather-context"><div className="planner-weather-current"><span>{weatherState.data.location.name}</span><strong>{weatherState.data.current.temperatureC}°C · {weatherState.data.current.condition}</strong><small>Humidity {weatherState.data.current.humidityPercent}% · Wind {weatherState.data.current.windSpeedKmh} km/h · Source: {weatherState.data.source}</small></div><div className="planner-forecast">{weatherState.data.forecast.map((day) => <span key={day.date}><b>{day.date}</b>{day.condition}<small>{day.minTemperatureC}–{day.maxTemperatureC}°C</small></span>)}</div></div>}</section><section className="planner-result-card"><p className="section-kicker">03 / PLAN RESULT</p>{plan ? <div className="planner-recommendation" aria-live="polite"><div className={`planner-status planner-status--${plan.status.toLowerCase()}`}><span>Status</span><strong>{statusLabel[plan.status]}</strong></div><h2>{plan.recommendation}</h2><div className="planner-explanation"><strong>Why</strong><p>{plan.reason}</p></div><div className="planner-explanation"><strong>Inputs used</strong><ul>{plan.inputSummary.map((item) => <li key={item}>{item}</li>)}</ul></div>{plan.weatherFactors.length > 0 && <div className="planner-explanation"><strong>Weather factors</strong><ul>{plan.weatherFactors.map((item) => <li key={item}>{item}</li>)}</ul></div>}<div className="planner-explanation"><strong>Limitations</strong><ul>{plan.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div><p className="planner-water-unknown">Water quantity cannot be estimated reliably from the available verified inputs.</p>{plan.sources.length > 0 && <p className="planner-source">Sources: {plan.sources.join(" · ")}</p>}</div> : <div className="empty-result"><Droplets size={24}/><div><strong>Your plan will appear here.</strong><p>Enter field inputs and a location to retrieve real weather context. Missing verified agronomic data will remain visible.</p></div></div>}</section><section className="planner-result-card planner-ai-card">
              <p className="section-kicker">03.5 / AI-ASSISTED GUIDANCE</p>
              {aiState.status === "idle" && plan && <div className="empty-result"><CloudSun size={22}/><div><strong>AI guidance will appear after you generate a plan.</strong></div></div>}
              {aiState.status === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Preparing AI-assisted explanation…</strong><p>The AI reads the deterministic plan and weather context. It does not invent numbers.</p></div></div>}
              {aiState.status === "ready" && <div className="ai-guidance" aria-live="polite"><div className="ai-guidance-badge"><span>AI-ASSISTED</span><small>Explanation only — all numbers come from the verified plan above</small></div><div className="ai-guidance-action"><strong>Recommended action</strong><p>{aiState.action}</p></div><div className="ai-guidance-why"><strong>Why</strong><p>{aiState.why}</p></div>{aiState.caution && <div className="ai-guidance-caution"><strong>Caution</strong><p>{aiState.caution}</p></div>}</div>}
              {aiState.status === "unavailable" && plan && <div className="service-state"><CloudSun size={20}/><div><strong>AI assistance is currently unavailable.</strong><p>The deterministic plan above remains your full recommendation.</p></div></div>}
            </section><section className="task-card"><div className="task-card-head"><div><p className="section-kicker">04 / FIELD TASKS</p><h2>Session to-do list</h2></div><span>{tasks.filter((item) => !item.completed).length} open</span></div><p className="task-session-note">Stored in this browser session only. Tasks are not shared, authenticated, or persisted to a server.</p><form className="task-form task-form--details" onSubmit={addTask}><input value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Add a field task" aria-label="Task title"/><input type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} aria-label="Task due date"/><select value={taskDraft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value }))} aria-label="Task priority"><option>High</option><option>Medium</option><option>Low</option></select><button className="button button--ochre" type="submit">Add task</button></form>{tasks.length === 0 ? <p className="task-empty">No tasks yet. Add the next action you want to remember.</p> : <div className="task-list">{tasks.map((item) => <label className={`task-item ${item.completed ? "task-item--done" : ""}`} key={item.id}><input type="checkbox" checked={item.completed} onChange={() => setTasks((items) => items.map((current) => current.id === item.id ? { ...current, completed: !current.completed } : current))}/><span>{item.title}<small>Due {item.dueDate} · {item.priority} priority</small></span></label>)}</div>}</section></div></div></section></PageFrame>;
}

function WeatherPage() {
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("empty");
  const [message, setMessage] = useState("");
  const [data, setData] = useState(null);
  const [requestMode, setRequestMode] = useState("manual");
  const [showMap, setShowMap] = useState(false);

  const loadWeatherForCoordinates = async (latitude, longitude, mode) => {
    setRequestMode(mode); setStatus("loading"); setMessage(""); setData(null);
    try { setData(await getWeatherForCoordinates(latitude, longitude)); setStatus("success"); }
    catch (error) { setStatus("error"); setMessage(error.message); }
  };
  const handleMapReady = (map) => {
    map.on("click", (event) => {
      setShowMap(false);
      void loadWeatherForCoordinates(event.latlng.lat, event.latlng.lng, "map");
    });
  };
  const loadWeather = async (event) => {
    event.preventDefault();
    const query = location.trim();
    if (!query) { setStatus("error"); setMessage("Enter a town, district, or village to check the weather."); return; }
    setShowMap(false); setRequestMode("manual"); setStatus("loading"); setMessage(""); setData(null);
    try { setData(await getWeather(query)); setStatus("success"); }
    catch (error) { setStatus("error"); setMessage(error.message); }
  };
  const loadCurrentLocation = () => {
    if (!navigator.geolocation) { setStatus("error"); setMessage("Current-location weather is unavailable in this browser. Search for a place manually."); return; }
    setShowMap(false); setRequestMode("current"); setStatus("loading"); setMessage(""); setData(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const isWithinIndia = coords.latitude >= 6 && coords.latitude <= 38.5 && coords.longitude >= 68 && coords.longitude <= 97.5;
        const isAccurateEnough = Number.isFinite(coords.accuracy) && coords.accuracy <= 5_000;
        if (isWithinIndia && isAccurateEnough) { void loadWeatherForCoordinates(coords.latitude, coords.longitude, "current"); return; }
        if (isWithinIndia) {
          setStatus("error");
          setMessage("Your browser location is too imprecise to use safely. Search manually or pick your exact location on the map.");
          return;
        }
        setStatus("error");
        setMessage("Your browser returned a location outside India. Search manually or pick your exact location on the map.");
      },
      (error) => {
        setStatus("error");
        setMessage(error.code === 1
          ? "Location permission was denied. Please allow location access or search for a place manually."
          : error.code === 3
            ? "Location request timed out. Try again or search for a place manually."
            : "Current-location weather is unavailable right now. Search for a place manually.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };
  const loadingMessage = requestMode === "current"
    ? "Getting your current location and weather…"
    : requestMode === "map"
      ? "Checking weather for the selected map location…"
      : "Checking the configured weather service…";

  return <PageFrame><section className="weather-page"><div className="content-width weather-head"><div><p className="eyebrow">FIELD TOOL / WEATHER APP</p><h1>Read the sky before you step out.</h1><p className="page-lead">Search a location for current conditions and forecast context when a weather provider is configured.</p></div><div className="weather-icon"><CloudSun size={46}/></div></div><div className="content-width weather-panel"><form className="weather-form" onSubmit={loadWeather}><label htmlFor="weather-location">Location</label><div><input id="weather-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Town, district, or village" autoComplete="off"/><button className="button button--ochre" type="submit" disabled={status === "loading"}>Check weather <ArrowRight size={15}/></button></div></form><div className="weather-location-actions"><button className="button button--location" type="button" onClick={loadCurrentLocation} disabled={status === "loading"}><LocateFixed size={15}/> Use my current location</button><button className="text-button" type="button" onClick={() => setShowMap((current) => !current)} disabled={status === "loading"} aria-expanded={showMap}>{showMap ? "Close map" : "Pick on Map"}</button></div>{showMap && <div className="weather-map-panel"><div className="weather-map-frame"><MapView initialCenter={WORLD_MAP_VIEWPORT} initialZoom={5} onMapReady={handleMapReady} loadingText="Loading map…" errorText="Map is temporarily unavailable. You can select your location manually."/></div></div>}{status === "loading" && <div className="weather-state"><span className="loading-dot"/><div><strong>{loadingMessage}</strong><p>No fallback location is substituted.</p></div></div>}{status === "empty" && <div className="weather-state"><CloudSun size={25}/><div><strong>No location checked yet.</strong><p>Enter a location to begin.</p></div></div>}{status === "error" && <div className="weather-state weather-state--error"><X size={25}/><div><strong>Weather unavailable</strong><p>{message}</p></div></div>}{status === "success" && data && <div className="weather-result" aria-live="polite"><div className="weather-location"><div><p className="section-kicker">CURRENT CONDITIONS</p><div className="weather-result-label">{requestMode === "manual" ? "SEARCH RESULT" : requestMode === "current" ? "CURRENT LOCATION" : "MAP LOCATION"}</div><h2>{data.location.name}{data.location.admin1 ? `, ${data.location.admin1}` : ""}</h2><p>{[data.location.country, `Source: ${data.source}`].filter(Boolean).join(" · ")}</p></div><CloudSun size={38}/></div><div className="weather-current"><div className="weather-temperature"><span>Temperature</span><strong>{Math.round(data.current.temperatureC)}°C</strong><b>{data.current.condition}</b></div><div className="weather-metrics"><div><span>Humidity</span><strong>{data.current.humidityPercent}%</strong></div><div><span>Wind</span><strong>{Math.round(data.current.windSpeedKmh)} km/h</strong></div><div><span>Current status</span><strong>{data.dayNight?.status || "Unknown"}</strong></div></div></div><div className="weather-forecast"><p className="section-kicker">03 / THREE-DAY FORECAST</p><div className="weather-forecast-grid">{data.forecast.map((day) => <article className="weather-day" key={day.date}><span>{day.date}</span><CloudSun size={24}/><strong>{day.condition}</strong><p><b>{Math.round(day.maxTemperatureC)}°</b><span>{Math.round(day.minTemperatureC)}° min</span></p></article>)}</div></div></div>}</div><div className="content-width weather-footnote"><p><span>Service boundary</span> This page reads `VITE_WEATHER_API_URL` and displays data returned by the server-side weather provider; no credentials are bundled in the client.</p></div></section></PageFrame>;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const isAdminUser = (user) => user?.role === "admin";

function ImageDetectionPage({ kind = "disease" }) {
  if (kind !== "disease") return <AnimalIntrusionPage/>;
  const [file, setFile] = useState(null); const [preview, setPreview] = useState(""); const [inputKey, setInputKey] = useState(0); const [status, setStatus] = useState("empty"); const [message, setMessage] = useState(""); const [result, setResult] = useState(null); const requestRef = useRef(0);
  const visibleParts = Array.isArray(result?.plantParts) ? result.plantParts.filter((part) => part !== "unknown") : [];
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); disposePlantVillageSecondaryValidator(); }, [preview]);
  const resetDetection = () => { requestRef.current += 1; if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(""); setInputKey((value) => value + 1); setStatus("empty"); setMessage(""); setResult(null); };
  const onFileChange = (event) => { const selected = event.target.files?.[0]; requestRef.current += 1; setMessage(""); setResult(null); setStatus("empty"); if (!selected) return; if (!acceptedImageTypes.includes(selected.type)) { setFile(null); setPreview(""); setStatus("error"); setMessage("Use a JPG, PNG, or WEBP image."); return; } if (!selected.size) { setFile(null); setPreview(""); setStatus("error"); setMessage("The selected image is empty."); return; } if (selected.size > MAX_IMAGE_BYTES) { setFile(null); setPreview(""); setStatus("error"); setMessage("Choose an image smaller than 8 MB."); return; } setFile(selected); setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(selected); }); };
  const submit = async (event) => { event.preventDefault(); if (status === "loading") return; if (!file) { setStatus("error"); setMessage("Choose an image before starting the check."); return; } const id = ++requestRef.current; setStatus("loading"); setMessage(""); setResult(null); try { const primary = await detectDisease(file); if (id !== requestRef.current) return; const finalResult = await applyPlantVillageSecondaryValidation(primary, file); if (id !== requestRef.current) return; setResult(finalResult); setStatus("success"); } catch (error) { if (id === requestRef.current) { setStatus("error"); setMessage(error.message); } } };
  return <PageFrame footer="agricultural"><section className="detection-page"><div className="content-width detection-head"><div><p className="eyebrow">CROP HEALTH / IMAGE CHECK</p><h1>Disease Detection</h1><p className="page-lead">Upload a crop image for the configured Kindwise Crop Health pipeline. Location is not requested or sent.</p></div><div className="detection-boundary"><span>WORKFLOW</span><strong>Image validation → optional gate → Kindwise → result</strong><small>Local38 runs only as a genuine secondary check when its verified model assets are available.</small></div></div><div className="content-width detection-layout"><form className="upload-panel" onSubmit={submit}><p className="section-kicker">01 / UPLOAD IMAGE</p><label className="upload-dropzone" htmlFor="disease-image"><input key={inputKey} id="disease-image" type="file" accept={acceptedImageTypes.join(",")} onChange={onFileChange}/>{preview ? <img src={preview} alt="Selected crop image preview"/> : <div className="upload-empty"><span className="upload-symbol">↑</span><strong>Choose a crop image</strong><span>JPG, PNG, or WEBP up to 8 MB</span></div>}</label><p className="detection-photo-hint"><strong>For better results:</strong> use a clear, well-lit image with the affected plant part and enough surrounding crop context.</p>{file && <div className="file-meta"><span>{file.name}</span><span>{Math.round(file.size / 1024)} KB</span></div>}<div className="upload-actions"><button className="button button--leaf" type="submit" disabled={status === "loading"}>{status === "loading" ? "Checking…" : "Start detection"} <ArrowRight size={15}/></button>{(file || status === "error") && <button className="text-button" type="button" onClick={resetDetection}>Reset image</button>}</div>{status === "error" && <div className="service-state service-state--error"><X size={22}/><div><strong>Unable to continue</strong><p>{message}</p></div></div>}</form><div className="detection-result-panel"><p className="section-kicker">02 / RESULT</p>{status === "empty" && <div className="empty-result detection-empty"><ShieldCheck size={25}/><div><strong>No result yet.</strong><p>No crop, disease, or confidence is generated until a configured provider returns it.</p></div></div>}{status === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Analyzing the image…</strong><p>The image is being sent to the configured server-side provider.</p></div></div>}{status === "success" && result && <div className="detection-result" aria-live="polite"><div className="detection-result-head"><div><span>Provider indication</span><strong>{result.diagnosis}</strong>{result.crop && result.crop !== "unknown" && <small className="detection-crop">Crop: {result.crop}{typeof result.cropConfidence === "number" ? ` (${Math.round(result.cropConfidence * 100)}%)` : ""}</small>}</div>{typeof result.confidence === "number" && <div className="detection-confidence"><span>Provider confidence</span><strong>{Math.round(result.confidence * 100)}%</strong></div>}</div>{result.secondaryValidation === "confirmed" && <p className="detection-secondary-confirmed"><ShieldCheck size={15}/> Local38 independently supports this indication.</p>}{result.secondaryValidation === "unavailable" && <p className="detection-secondary-unavailable">The optional Local38 secondary model is unavailable. The primary Kindwise result is shown without pretending that a second check ran.</p>}{result.secondaryValidation === "conflict" && <p className="detection-uncertain">Primary and secondary results conflict, so no disease conclusion is presented.</p>}{(visibleParts.length > 0 || result.imageStatus || result.diagnosticEvidence) && <div className="detection-image-meta">{visibleParts.length > 0 && <span>Visible parts: {visibleParts.join(", ").replaceAll("_", " ")}</span>}{result.imageStatus && <span>Image check: {result.imageStatus.replaceAll("_", " ").toLowerCase()}</span>}{result.diagnosticEvidence && <span>Evidence: {result.diagnosticEvidence.toLowerCase()}</span>}</div>}{result.uncertain === true && <p className="detection-uncertain">The provider reported uncertainty. Upload a clearer image or seek expert confirmation.</p>}{result.note && <p className="detection-result-note">{result.note}</p>}<p className="detection-disclaimer">This image-based indication is not a substitute for laboratory or agricultural-expert diagnosis.</p><DiseaseActionGuidance result={result} onCheckAnother={resetDetection}/></div>}{status === "error" && <div className="empty-result detection-empty"><ShieldCheck size={25}/><div><strong>Result unavailable</strong><p>Nothing was inferred or fabricated. Review the configuration or error above.</p></div></div>}</div></div></section></PageFrame>;
}

function AnimalIntrusionPage() {
  return <PageFrame footer="agricultural"><section className="detection-page intrusion-page"><div className="content-width detection-head"><div><p className="eyebrow">AI + CV / FARM SAFETY</p><h1>Animal / Farm Intrusion Detection</h1><p className="page-lead">Use a local live camera for on-device object monitoring, or keep the existing upload workflow separate for one-time analysis.</p></div><div className="detection-boundary"><span>ON-DEVICE WORKFLOW</span><strong>Camera → COCO-SSD → Visual event</strong><small>Live webcam frames remain in your browser.</small></div></div><div className="content-width intrusion-page__layout"><LiveIntrusionMonitor/><IntrusionUploadPanel/></div><div className="content-width detection-notes"><span>Important limitation</span><p>This is an on-device object-detection MVP. It identifies supported visual objects in the camera frame; it does not determine whether a detected person is authorized or whether an event constitutes a real security breach.</p></div></section></PageFrame>;
}


function SoilAnalysisPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [status, setStatus] = useState("empty");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const resetAnalysis = () => {
    requestRef.current += 1;
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(""); setInputKey((value) => value + 1); setStatus("empty"); setMessage(""); setResult(null);
  };
  const onFileChange = (event) => {
    const selected = event.target.files?.[0];
    requestRef.current += 1; setMessage(""); setResult(null); setStatus("empty");
    if (!selected) return;
    const failValidation = (validationMessage) => {
      setFile(null); setPreview((current) => { if (current) URL.revokeObjectURL(current); return ""; });
      setStatus("validation"); setMessage(validationMessage); event.target.value = "";
    };
    if (!acceptedImageTypes.includes(selected.type)) { failValidation("Use a JPG, PNG, or WEBP soil image."); return; }
    if (!selected.size) { failValidation("The selected soil image is empty."); return; }
    if (selected.size > MAX_IMAGE_BYTES) { failValidation("Choose a soil image smaller than 8 MB."); return; }
    setFile(selected);
    setPreview((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(selected); });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (status === "loading") return;
    if (!file) { setStatus("validation"); setMessage("Choose a soil image before starting the analysis."); return; }
    const requestId = ++requestRef.current;
    setStatus("loading"); setMessage(""); setResult(null);
    try {
      const analysis = await analyzeSoilImage(file);
      if (requestId !== requestRef.current) return;
      setResult(analysis); setStatus("success");
    } catch (error) {
      if (requestId !== requestRef.current) return;
      const nextStatus = [400, 413, 415].includes(error.status) ? "validation" : error.code === "AI_NOT_CONFIGURED" ? "unconfigured" : "error";
      setStatus(nextStatus); setMessage(error.message);
    }
  };
  const hasUsableSoilResult = status === "success" && result?.imageStatus === "soil_image";

  return <PageFrame footer="agricultural"><section className="soil-analysis-page"><div className="content-width soil-analysis-head"><div><p className="eyebrow">FIELD TOOL / SOIL ANALYSIS</p><h1>Read the visible soil surface with care.</h1><p className="page-lead">Upload a clear soil image for cautious AI-based observations and general crop, irrigation, and soil-management context.</p></div><div className="soil-analysis-boundary"><span>IMAGE-BASED WORKFLOW</span><strong>Upload → Validate → AI observation → General guidance</strong><small>No laboratory or sensor measurements are inferred.</small></div></div><div className="content-width soil-analysis-layout"><form className="upload-panel soil-analysis-upload" onSubmit={submit}><p className="section-kicker">01 / UPLOAD SOIL IMAGE</p><label className="upload-dropzone" htmlFor="soil-analysis-image"><input key={inputKey} id="soil-analysis-image" type="file" accept={acceptedImageTypes.join(",")} onChange={onFileChange}/>{preview ? <img src={preview} alt="Selected soil image preview"/> : <div className="upload-empty"><span className="upload-symbol">↑</span><strong>Choose a soil image</strong><span>JPG, PNG, or WEBP up to 8 MB</span></div>}</label><p className="soil-analysis-photo-hint">Use a clear, well-lit photo showing the soil surface. Avoid filters, heavy blur, or distant field views.</p>{file && <div className="file-meta"><span>{file.name}</span><span>{Math.round(file.size / 1024)} KB</span></div>}<div className="upload-actions"><button className="button button--leaf" type="submit" disabled={status === "loading"}>{status === "loading" ? "Analyzing…" : "Analyze soil image"} <ArrowRight size={15}/></button>{(file || status === "validation") && <button className="text-button" type="button" onClick={resetAnalysis}>Reset image</button>}</div>{status === "validation" && <div className="service-state service-state--error" role="alert"><X size={21}/><div><strong>Image validation failed</strong><p>{message}</p></div></div>}</form><div className="soil-analysis-results"><p className="section-kicker">02 / AI IMAGE ANALYSIS</p>{(status === "empty" || status === "validation") && <div className="empty-result soil-analysis-empty"><Droplets size={25}/><div><strong>No analysis yet.</strong><p>Upload a soil image to begin. No result is generated until the configured AI provider responds.</p></div></div>}{status === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Analyzing the soil image…</strong><p>The validated image is being sent to the configured server-side AI provider.</p></div></div>}{status === "unconfigured" && <div className="service-state"><X size={21}/><div><strong>AI soil analysis is not configured.</strong><p>{message}</p></div></div>}{status === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Analysis unavailable</strong><p>{message || "No soil characteristics or guidance were generated."}</p></div></div>}{status === "success" && result && !hasUsableSoilResult && <div className="service-state service-state--error" role="status"><X size={21}/><div><strong>AI could not confirm a usable soil image.</strong><p>{result.note}</p></div></div>}{hasUsableSoilResult && <div className="soil-analysis-result" aria-live="polite"><div className="soil-analysis-primary"><span>Likely soil type</span><h2>{result.likelySoilType}</h2><p>{result.note}</p><small>AI image observation only</small></div><div className="soil-analysis-result-grid"><article><h3>Visible texture and characteristics</h3><ul>{result.visibleCharacteristics.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>Potentially suitable crops</h3><ul>{result.suitableCrops.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>General irrigation guidance</h3><ul>{result.irrigationAdvice.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>Basic soil-management guidance</h3><ul>{result.managementAdvice.map((item) => <li key={item}>{item}</li>)}</ul></article></div></div>}</div></div><div className="content-width soil-analysis-footnote"><ShieldCheck size={18}/><p><span>Laboratory testing note</span> An ordinary soil image cannot measure exact pH, NPK, moisture percentage, electrical conductivity, temperature, or other laboratory or sensor values. Use a laboratory soil test when measured nutrient or chemistry values are needed.</p></div></section></PageFrame>;
}

const eventData = [
  { id: "field-day", title: "Community Field Day", date: "Oct 18, 2026", place: "Nashik agricultural support desk", type: "WORKSHOP", description: "A practical gathering for field notes, soil context, and farmer-to-farmer learning." },
  { id: "soil-session", title: "Soil Health Session", date: "Nov 02, 2026", place: "Online community room", type: "SESSION", description: "A guided conversation about sampling, pH context, and making lab results easier to use." },
  { id: "seed-meetup", title: "Seed & Season Meetup", date: "Nov 21, 2026", place: "Community partner venue", type: "MEETUP", description: "Bring your crop questions and compare seasonal planning notes with the wider community." },
];

function CommunityLandingPage() {
  return <PageFrame><section className="community-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 26, 18, .74), rgba(5, 26, 18, .24)), url(${heroImage})` }}><div className="content-width community-hero-content"><p className="eyebrow eyebrow--light">COMMUNITY / KRISHAK</p><h1>Welcome to the Farmer Community</h1><p>Connect with fellow farmers, share knowledge, find practical events, and keep support close to the field.</p><div className="hero-actions"><Link href="/community/discussion-forum" className="button button--ochre">Explore discussions <ArrowRight size={16}/></Link><Link href="/community/community-events" className="text-link text-link--light">View events <ArrowRight size={16}/></Link></div></div></section><section className="community-intro content-width"><p className="eyebrow">A SHARED FIELD NOTEBOOK</p><h2>Three ways to take part.</h2><div className="community-links"><Link href="/community/discussion-forum"><MessageCircle size={22}/><strong>Discussion Forums</strong><span>Share a question, article, or field note.</span></Link><Link href="/community/sikayat-kendra"><ShieldCheck size={22}/><strong>Sikayat Kendra</strong><span>Submit and follow an agricultural complaint.</span></Link><Link href="/community/community-events"><CalendarDays size={22}/><strong>Community Events</strong><span>Find workshops, meetups, and local activity.</span></Link></div></section></PageFrame>;
}

function AuthPage({ mode = "login" }) {
  const isLogin = mode === "login"; const { login, signup, authStatus, authError, isAuthenticated } = useAuth(); const [, navigate] = useLocation(); const [form, setForm] = useState({ name: "", email: "", password: "", farmName: "", role: "farmer", adminSetupSecret: "" }); const [message, setMessage] = useState("");
  const submit = async (event) => { event.preventDefault(); setMessage(""); try { const payload = isLogin ? await login({ email: form.email, password: form.password }) : await signup({ name: form.name, farmName: form.farmName, email: form.email, password: form.password, role: form.role, ...(form.role === "admin" ? { adminSetupSecret: form.adminSetupSecret } : {}) }); setMessage("Authentication completed. Your session is ready."); const requested = new URLSearchParams(window.location.search).get("returnTo"); const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : payload?.user?.role === "admin" ? "/admin" : "/profile"; navigate(destination); } catch (error) { setMessage(error.message); } };
  if (isAuthenticated) return <PageFrame><section className="auth-page"><div className="auth-card"><p className="eyebrow">COMMUNITY ACCOUNT</p><h1>You are already signed in.</h1><Link href="/profile" className="button button--leaf">Open profile <ArrowRight size={15}/></Link></div></section></PageFrame>;
  return <PageFrame><section className="auth-page"><div className="auth-card"><p className="eyebrow">{isLogin ? "COMMUNITY / LOGIN" : "COMMUNITY / SIGNUP"}</p><h1>{isLogin ? "Keep your community work close." : "Create your community account."}</h1><p className="page-lead">{isLogin ? "Sign in with the email and password used for your account." : "Choose Farmer or Admin. The server verifies the requested role before storing it."}</p><form className="auth-form" onSubmit={submit}>{!isLogin && <><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, adminSetupSecret: "" })}><option value="farmer">Farmer</option><option value="admin">Admin</option></select></label>{form.role === "admin" && <label>Admin signup code<input required type="password" autoComplete="one-time-code" value={form.adminSetupSecret} onChange={(event) => setForm({ ...form, adminSetupSecret: event.target.value })}/></label>}<label>Farm name<input value={form.farmName} onChange={(event) => setForm({ ...form, farmName: event.target.value })}/></label></>}<label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label><label>Password<input required type="password" minLength={!isLogin && form.role === "admin" ? 12 : 8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/></label><button className="button button--leaf" disabled={authStatus === "loading"} type="submit">{authStatus === "loading" ? "Connecting…" : isLogin ? "Login" : "Create account"} <ArrowRight size={15}/></button></form>{(authError || message) && <div className="service-state service-state--error"><X size={21}/><div><strong>{isLogin ? "Login status" : "Signup status"}</strong><p>{authError || message}</p></div></div>}<p className="auth-switch">{isLogin ? "Need an account?" : "Already have an account?"} <Link href={isLogin ? "/signup" : "/login"}>{isLogin ? "Sign up" : "Log in"}</Link></p></div></section></PageFrame>;
}

function RequireCommunityAuth({ path, requiredRole, children }) {
  const { isAuthenticated, authStatus, user } = useAuth();
  const [, navigate] = useLocation();
  const roleMismatch = requiredRole && user?.role !== requiredRole;
  useEffect(() => {
    if (authStatus !== "loading" && !isAuthenticated) navigate(`/login?returnTo=${encodeURIComponent(path)}`);
    else if (authStatus !== "loading" && (roleMismatch)) navigate("/");
  }, [authStatus, isAuthenticated, roleMismatch, navigate, path]);
  if (authStatus === "loading" || !isAuthenticated || roleMismatch) return null;
  return children;
}

function DiscussionForumPage() {
  const { token } = useAuth(); const [items, setItems] = useState([]); const [status, setStatus] = useState("idle"); const [message, setMessage] = useState(""); const [query, setQuery] = useState("");
  const load = async () => { setStatus("loading"); try { const data = await getDiscussions(); setItems(data.discussions || data || []); setStatus("ready"); } catch (error) { setStatus("error"); setMessage(error.message); } };
  const visible = items.filter((item) => `${item.title || ""} ${item.description || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <PageFrame><section className="forum-page"><div className="content-width forum-head"><div><p className="eyebrow">COMMUNITY / DISCUSSION FORUM</p><h1>Bring the field question to the room.</h1><p className="page-lead">Browse farmer discussions, then open a detail view or create a new post with the full crop context.</p></div><div className="forum-actions"><Link href="/community/discussion-forum/create" className="button button--ochre">Create discussion <ArrowRight size={15}/></Link>{!token && <Link href="/login" className="text-link">Login for posting <ArrowRight size={15}/></Link>}</div></div><div className="content-width forum-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discussions" aria-label="Search discussions"/><button className="button button--leaf" onClick={load}>{status === "loading" ? "Loading…" : "Load discussions"}</button></div><div className="content-width forum-list">{status === "idle" && <div className="empty-result empty-result--wide"><MessageCircle size={24}/><div><strong>Discussion feed is ready to connect.</strong><p>Load the configured community service to browse real posts. No fake user-generated discussions are shown.</p></div></div>}{status === "error" && <div className="service-state service-state--error"><X size={22}/><div><strong>Discussion feed unavailable</strong><p>{message}</p></div></div>}{status === "ready" && visible.length === 0 && <div className="empty-result empty-result--wide"><MessageCircle size={24}/><div><strong>No discussions match this search.</strong><p>Try another term or create a new discussion.</p></div></div>}{status === "ready" && visible.map((item) => <Link className="discussion-card" href={`/community/discussion-forum/details?id=${item.id || item._id}`} key={item.id || item._id}><div><p className="eyebrow">{item.problemType || "FIELD DISCUSSION"}</p><h2>{item.title || "Untitled discussion"}</h2><p>{item.description || "Open this discussion to read the full field context."}</p></div><ArrowRight size={19}/></Link>)}</div></section></PageFrame>;
}

function CreateDiscussionPage() {
  const { token } = useAuth(); const [status, setStatus] = useState("idle"); const [message, setMessage] = useState(""); const [form, setForm] = useState({ username: "", email: "", farmName: "", title: "", cropType: "", cropVariety: "", growthStage: "", problemType: "", detailedDescription: "", imageName: "", imageDescription: "", desiredOutcome: "", previousTreatments: "" });
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => { event.preventDefault(); if (!token) { setStatus("error"); setMessage("Login is required before creating a discussion."); return; } setStatus("loading"); try { await createDiscussion(buildDiscussionPayload(form), token); setStatus("success"); setMessage("Discussion submitted to the configured community service."); } catch (error) { setStatus("error"); setMessage(error.message); } };
  return <PageFrame><section className="post-page"><div className="content-width post-head"><p className="eyebrow">COMMUNITY / CREATE DISCUSSION</p><h1>Give the field question enough context.</h1><p className="page-lead">Keep the reference fields intact so another farmer can understand the situation and respond usefully.</p></div><form className="content-width post-form" onSubmit={submit}><div className="post-form-grid">{[["username","Username"],["email","Email"],["farmName","Farm name"],["title","Title"],["cropType","Crop type"],["cropVariety","Crop variety"],["growthStage","Growth stage"],["problemType","Problem type"]].map(([key,label]) => <label key={key}>{label}<input required={!["username","email","farmName"].includes(key)} value={form[key]} onChange={update(key)}/></label>)}</div><label>Detailed description<textarea required rows="5" value={form.detailedDescription} onChange={update("detailedDescription")} /></label><label>Images<input type="file" accept="image/*" onChange={(event) => setForm({ ...form, imageName: event.target.files?.[0]?.name || "" })}/>{form.imageName && <span className="file-meta">Selected: {form.imageName}</span>}</label><label>Image descriptions<textarea rows="3" value={form.imageDescription} onChange={update("imageDescription")} /></label><label>Desired outcome<textarea rows="3" value={form.desiredOutcome} onChange={update("desiredOutcome")} /></label><label>Previous treatments<textarea rows="3" value={form.previousTreatments} onChange={update("previousTreatments")} /></label><button className="button button--leaf" type="submit">{status === "loading" ? "Submitting…" : "Submit discussion"} <ArrowRight size={15}/></button>{message && <div className={`service-state ${status === "error" ? "service-state--error" : ""}`}><Check size={21}/><div><strong>{status === "success" ? "Submitted" : "Unable to submit"}</strong><p>{message}</p></div></div>}</form></section></PageFrame>;
}

function DiscussionDetailsPage() {
  const { token, user } = useAuth(); const [status, setStatus] = useState("idle"); const [message, setMessage] = useState(""); const [discussion, setDiscussion] = useState(null); const [comments, setComments] = useState([]); const [commentsStatus, setCommentsStatus] = useState("idle"); const [commentsMessage, setCommentsMessage] = useState(""); const [commentText, setCommentText] = useState(""); const [commentSubmitStatus, setCommentSubmitStatus] = useState("idle"); const [editingCommentId, setEditingCommentId] = useState(null); const [editingCommentText, setEditingCommentText] = useState(""); const [commentActionStatus, setCommentActionStatus] = useState("idle"); const [commentActionMessage, setCommentActionMessage] = useState(""); const [chatStatus, setChatStatus] = useState({ state: "idle", message: "Chat is ready to connect when a discussion is selected." }); const [chatMessage, setChatMessage] = useState(""); const [sendChat, setSendChat] = useState(null); const [chatMessages, setChatMessages] = useState([]);
  const load = async () => { setStatus("loading"); try { const id = new URLSearchParams(window.location.search).get("id"); if (!id) throw new Error("Select a discussion from the forum to open its details."); const data = await getDiscussion(id); setDiscussion(data.discussion || data); setStatus("ready"); } catch (error) { setStatus("error"); setMessage(error.message); } };
  const loadComments = async () => { setCommentsStatus("loading"); try { const id = new URLSearchParams(window.location.search).get("id"); if (!id) throw new Error("Select a discussion from the forum to view comments."); const data = await getDiscussionComments(id); setComments(data.comments || []); setCommentsStatus("ready"); setCommentsMessage(""); } catch (error) { setCommentsStatus("error"); setCommentsMessage(error.message); } };
  const submitComment = async (event) => { event.preventDefault(); if (!token) { setCommentSubmitStatus("error"); setCommentsMessage("Login is required before posting a comment."); return; } const text = commentText.trim(); if (!text) { setCommentSubmitStatus("error"); setCommentsMessage("Write a comment before posting."); return; } const id = new URLSearchParams(window.location.search).get("id"); if (!id) { setCommentSubmitStatus("error"); setCommentsMessage("Select a discussion before posting a comment."); return; } setCommentSubmitStatus("loading"); try { const data = await createDiscussionComment(id, text, token); const comment = data.comment || data; setComments((items) => [...items, comment]); setCommentText(""); setCommentSubmitStatus("success"); setCommentsMessage(""); } catch (error) { setCommentSubmitStatus("error"); setCommentsMessage(error.message); } };
  const startCommentEdit = (comment) => { setEditingCommentId(comment.id); setEditingCommentText(comment.text); setCommentActionMessage(""); };
  const cancelCommentEdit = () => { setEditingCommentId(null); setEditingCommentText(""); setCommentActionMessage(""); };
  const saveCommentEdit = async (commentId) => { const text = editingCommentText.trim(); if (!text) { setCommentActionStatus("error"); setCommentActionMessage("Comment text is required."); return; } setCommentActionStatus(`saving-${commentId}`); setCommentActionMessage(""); try { const data = await updateDiscussionComment(commentId, text, token); const updatedComment = data.comment || data; setComments((items) => items.map((comment) => comment.id === commentId ? updatedComment : comment)); setEditingCommentId(null); setEditingCommentText(""); setCommentActionStatus("success"); } catch (error) { setCommentActionStatus("error"); setCommentActionMessage(error.message); } };
  const removeComment = async (commentId) => { if (!window.confirm("Delete this comment? This cannot be undone.")) return; setCommentActionStatus(`deleting-${commentId}`); setCommentActionMessage(""); try { await deleteDiscussionComment(commentId, token); setComments((items) => items.filter((comment) => comment.id !== commentId)); setCommentActionStatus("success"); } catch (error) { setCommentActionStatus("error"); setCommentActionMessage(error.message); } };
  useEffect(() => { loadComments(); }, []);
  useEffect(() => { const discussionId = new URLSearchParams(window.location.search).get("id"); const cleanup = openChatConnection({ token, roomId: discussionId, onMessage: (msg) => setChatMessages((prev) => [...prev, msg]), onHistory: (msgs) => setChatMessages(msgs), onStatus: setChatStatus, onReady: setSendChat }); return cleanup; }, [token]);
  const sendMessage = async () => { if (!sendChat || !chatMessage.trim()) return; try { await sendChat({ discussionId: new URLSearchParams(window.location.search).get("id"), text: chatMessage.trim() }); setChatMessage(""); } catch { /* The service boundary already exposes the truthful failure state. */ } };
  return <PageFrame><section className="discussion-detail-page"><div className="content-width"><p className="eyebrow">COMMUNITY / DISCUSSION DETAILS</p><h1>Read the full field context.</h1><div className="detail-actions"><button className="button button--leaf" onClick={load}>{status === "loading" ? "Loading…" : "Load discussion"}</button><Link href="/community/discussion-forum" className="text-link">Back to forum <ArrowRight size={15}/></Link></div>{status === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Discussion unavailable</strong><p>{message}</p></div></div>}{status === "ready" && discussion && <article className="discussion-detail-card"><p className="eyebrow">{discussion.problemType || "FIELD DISCUSSION"}</p><h2>{discussion.title || "Discussion"}</h2><p>{discussion.detailedDescription || discussion.description || "No description returned."}</p><div className="detail-meta"><span>Crop <b>{discussion.cropType || "Not provided"}</b></span><span>Growth stage <b>{discussion.growthStage || "Not provided"}</b></span><span>Desired outcome <b>{discussion.desiredOutcome || "Not provided"}</b></span></div></article>}<section className="comments-panel"><div className="comments-heading"><div><p className="section-kicker">DISCUSSION COMMENTS</p><h2>Share a field note.</h2></div>{commentsStatus === "ready" && <span>{comments.length} {comments.length === 1 ? "comment" : "comments"}</span>}</div>{commentsStatus === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Loading comments…</strong><p>Requesting persisted discussion comments.</p></div></div>}{commentsStatus === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Comments unavailable</strong><p>{commentsMessage}</p><button className="text-button" type="button" onClick={loadComments}>Retry comments</button></div></div>}{commentsStatus === "ready" && comments.length === 0 && <div className="empty-result"><MessageCircle size={23}/><div><strong>No comments yet. Be the first to share your thoughts.</strong></div></div>}{commentsStatus === "ready" && comments.length > 0 && <div className="comment-list">{comments.map((comment) => { const isOwner = Boolean(token && user && String(comment.authorId) === String(user.id)); const isEditing = editingCommentId === comment.id; return <article className="comment-card" key={comment.id}><div className="comment-meta"><strong>{comment.authorName || "Community member"}</strong><span>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Timestamp unavailable"}</span></div>{isEditing ? <div className="comment-edit-form"><label>Edit comment<textarea rows="3" maxLength="2000" value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} /></label><div className="comment-edit-actions"><button className="button button--leaf" type="button" disabled={commentActionStatus === `saving-${comment.id}`} onClick={() => saveCommentEdit(comment.id)}>{commentActionStatus === `saving-${comment.id}` ? "Saving…" : "Save"}</button><button className="text-button" type="button" onClick={cancelCommentEdit}>Cancel</button></div></div> : <p>{comment.text}</p>}{isOwner && !isEditing && <div className="comment-owner-actions"><button className="text-button" type="button" onClick={() => startCommentEdit(comment)}>Edit</button><button className="text-button text-button--danger" type="button" disabled={commentActionStatus === `deleting-${comment.id}`} onClick={() => removeComment(comment.id)}>{commentActionStatus === `deleting-${comment.id}` ? "Deleting…" : "Delete"}</button></div>}</article>; })}</div>}{commentActionStatus === "error" && <p className="comment-form-error" role="alert">{commentActionMessage}</p>}{token ? <form className="comment-form" onSubmit={submitComment}><label>Add a comment<textarea rows="3" maxLength="2000" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Share a helpful field note"/></label><button className="button button--leaf" type="submit" disabled={commentSubmitStatus === "loading"}>{commentSubmitStatus === "loading" ? "Posting…" : "Post comment"} <ArrowRight size={15}/></button>{commentSubmitStatus === "error" && <p className="comment-form-error" role="alert">{commentsMessage}</p>}</form> : <p className="comment-login-note">Login is required before posting a comment. <Link href="/login" className="text-link">Login <ArrowRight size={15}/></Link></p>}</section><section className="chat-panel"><div><p className="section-kicker">DISCUSSION CHAT</p><h2>Keep the conversation close.</h2></div><div className={`chat-state chat-state--${chatStatus.state}`}><MessageCircle size={21}/><div><strong>{chatStatus.state === "connected" ? "Chat connected" : "Chat unavailable"}</strong><p>{chatStatus.message}</p></div></div><div className="chat-form"><input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Write a message when chat is connected" disabled={chatStatus.state !== "connected"}/><button className="button button--ochre" disabled={chatStatus.state !== "connected" || !chatMessage.trim() || !sendChat} onClick={sendMessage}>Send</button></div></section></div></section></PageFrame>;
}

function EventsPage() { return <PageFrame><section className="events-page"><div className="content-width events-head"><div><p className="eyebrow">COMMUNITY / EVENTS</p><h1>Make room for the next gathering.</h1><p className="page-lead">Browse the reference event list and open details for the event closest to your field or community.</p></div><CalendarDays size={58} className="events-icon"/></div><div className="content-width event-grid">{eventData.map((event) => <Link href={`/community/community-events/details?id=${event.id}`} className="event-card" key={event.id}><div className="event-card-date"><span>{event.date.split(" ")[0]}</span><b>{event.date.split(" ")[1]}</b></div><div><p className="eyebrow">{event.type}</p><h2>{event.title}</h2><p>{event.description}</p><span>{event.place}</span></div><ArrowRight size={18}/></Link>)}</div></section></PageFrame>; }

function EventDetailsPage() { const id = new URLSearchParams(window.location.search).get("id") || eventData[0].id; const event = eventData.find((item) => item.id === id) || eventData[0]; return <PageFrame><section className="event-detail-page"><div className="content-width"><p className="eyebrow">COMMUNITY / EVENT DETAILS</p><h1>{event.title}</h1><p className="page-lead">{event.description}</p><div className="event-detail-grid"><div className="event-detail-main"><div className="event-detail-hero"><CalendarDays size={42}/><span>{event.type}</span></div><h2>What to expect</h2><p>This event page keeps the reference browsing flow: date, place, and a practical description first. Registration and attendance actions will connect when event persistence is configured.</p></div><aside className="event-detail-side"><p><span>Date</span><strong>{event.date}</strong></p><p><span>Place</span><strong>{event.place}</strong></p><Link href="/community/community-events" className="button button--ochre">Back to events <ArrowRight size={15}/></Link></aside></div></div></section></PageFrame>; }

function SikayatKendraPage() {
  const { token, user } = useAuth();
  const [form, setForm] = useState({
    subject: "",
    category: "",
    description: "",
    location: "",
  });
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const update = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();

    if (!token) {
      setStatus("error");
      setMessage("Login is required before submitting a complaint.");
      return;
    }

    setStatus("loading");

    try {
      await submitComplaint(form, token);
      setStatus("success");
      setMessage("Complaint submitted to the configured support service.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  };

  const load = async () => {
    if (!token) {
      setStatus("error");
      setMessage("Login is required to view authorized complaints.");
      return;
    }

    setStatus("loading");

    try {
      const data = isAdminUser(user)
        ? await getAdminComplaints(token)
        : await getMyComplaints(token);

      setItems(data.complaints || data || []);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  };

  return (
    <PageFrame>
      <section className="complaint-page">
        <div className="content-width complaint-head">
          <div>
            <p className="eyebrow">COMMUNITY / SIKAYAT KENDRA</p>

            <h1>Make the concern visible to the right people.</h1>

            <p className="page-lead">
              Submit a complaint, check the authorized list, and show admin
              controls only when the backend returns an admin role.
            </p>
          </div>

          <ShieldCheck size={58} className="complaint-icon" />
        </div>

        <div className="content-width complaint-layout">

          {!isAdminUser(user) && (
            <form className="complaint-form" onSubmit={submit}>
              <p className="section-kicker">01 / SUBMIT COMPLAINT</p>

              <label>
                Subject
                <input
                  required
                  value={form.subject}
                  onChange={update("subject")}
                />
              </label>

              <label>
                Category
                <select
                  value={form.category}
                  onChange={update("category")}
                >
                  <option value="">Choose a category</option>
                  <option>Crop issue</option>
                  <option>Market issue</option>
                  <option>Water issue</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Location
                <input
                  value={form.location}
                  onChange={update("location")}
                />
              </label>

              <label>
                Description
                <textarea
                  required
                  rows="5"
                  value={form.description}
                  onChange={update("description")}
                />
              </label>

              <button
                className="button button--leaf"
                type="submit"
              >
                {status === "loading"
                  ? "Submitting…"
                  : "Submit complaint"}
                <ArrowRight size={15} />
              </button>

              {message && (
                <div
                  className={`service-state ${
                    status === "error"
                      ? "service-state--error"
                      : ""
                  }`}
                >
                  <Check size={21} />

                  <div>
                    <strong>
                      {status === "success"
                        ? "Submitted"
                        : "Support status"}
                    </strong>

                    <p>{message}</p>
                  </div>
                </div>
              )}
            </form>
          )}

          <div className="complaint-list-panel">
            <div className="list-heading">
              <div>
                <p className="section-kicker">
                  {isAdminUser(user)
                    ? "01 / ADMIN COMPLAINT QUEUE"
                    : "02 / AUTHORIZED LIST"}
                </p>

                <h2>
                  {isAdminUser(user)
                    ? "Admin complaint queue"
                    : "My complaints"}
                </h2>
              </div>

              <button
                className="button button--ochre"
                onClick={load}
              >
                {status === "loading" ? "Loading…" : "Load list"}
              </button>
            </div>

            {items.length === 0 ? (
              <div className="empty-result">
                <ShieldCheck size={23} />

                <div>
                  <strong>No complaints loaded.</strong>

                  <p>
                    Login and load the authorized list. Nothing is
                    fabricated in the empty state.
                  </p>
                </div>
              </div>
            ) : (
              <div className="complaint-items">
                {items.map((item) => (
                  <div
                    className="complaint-item"
                    key={item.id || item._id}
                  >
                    <strong>{item.subject}</strong>

                    <span>
                      {item.status || "Submitted"}
                    </span>

                    <p>{item.description}</p>

                    {isAdminUser(user) && (
                      <div className="complaint-admin-actions">
                        <button
                          className="text-button"
                          onClick={() => {
                            updateComplaint(
                              item.id || item._id,
                              { status: "resolved" },
                              token
                            )
                              .then(() => load())
                              .catch((err) => {
                                setStatus("error");
                                setMessage(err.message);
                              });
                          }}
                        >
                          Mark resolved
                        </button>

                        <button
                          className="text-button text-button--danger"
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Permanently delete this complaint? This cannot be undone."
                              )
                            ) {
                              return;
                            }

                            deleteComplaint(
                              item.id || item._id,
                              token
                            )
                              .then(() =>
                                setItems((cs) =>
                                  cs.filter(
                                    (c) =>
                                      (c.id || c._id) !==
                                      (item.id || item._id)
                                  )
                                )
                              )
                              .catch((err) => {
                                setStatus("error");
                                setMessage(err.message);
                              });
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
function ResourcesPage() { const resources = [{ title: "Best Practices", copy: "Field routines and practical checklists for more consistent work." }, { title: "Crop Management", copy: "Keep crop stage, soil context, and seasonal decisions together." }, { title: "Soil Health", copy: "Use the guide and testing workflow to make soil notes traceable." }, { title: "Sustainable Farming", copy: "A place for lower-waste, longer-horizon field practices." }, { title: "Equipment & Tools", copy: "Reference notes for the tools that support daily field work." }, { title: "Market Trends", copy: "A future resource surface for market context from a configured source." }]; return <PageFrame><section className="resources-page"><div className="content-width"><p className="eyebrow">COMMUNITY / RESOURCES</p><h1>Useful context, kept close.</h1><p className="page-lead">A curated resource index for farmers. Live market data is not shown until a source is connected.</p><div className="resource-grid">{resources.map((item) => <article className="resource-card" key={item.title}><Leaf size={23}/><h2>{item.title}</h2><p>{item.copy}</p><Link href="/guide" className="text-link">Open resource <ArrowRight size={15}/></Link></article>)}</div></div></section></PageFrame>; }

function ProfilePage() { const { user, isAuthenticated, logout } = useAuth(); return <PageFrame><section className="profile-page"><div className="content-width profile-card"><p className="eyebrow">COMMUNITY / PROFILE</p><h1>Your field identity.</h1>{isAuthenticated ? <><div className="profile-summary"><div className="profile-avatar">{(user?.name || user?.email || "F").slice(0,1).toUpperCase()}</div><div><h2>{user?.name || "Farmer profile"}</h2><p>{user?.email || "Email returned by the community service"}</p><span>{user?.role || "farmer"}</span></div></div><div className="profile-links">{user?.role !== "admin" && (<Link href="/community/discussion-forum/create" className="button button--leaf">Create discussion <ArrowRight size={15}/></Link>)}<Link href="/community/sikayat-kendra" className="button button--ochre">Open Sikayat Kendra <ArrowRight size={15}/></Link><button className="text-button" onClick={logout}>Log out</button></div></> : <div className="empty-result"><ShieldCheck size={24}/><div><strong>Login to view your profile.</strong><p>Your database-backed opaque session and role are returned by the configured community service.</p><Link href="/login" className="text-link">Login <ArrowRight size={15}/></Link></div></div>}</div></section></PageFrame>; }

function CropRecommendationPage() {
  const [soil, setSoil] = useState(""); const [crop, setCrop] = useState("");
  const guidance = getCropReferenceGuidance(soil, crop);
  return <PageFrame footer="agricultural"><section className="recommendation-only-page"><div className="content-width"><p className="eyebrow">FIELD GUIDE / CROP REFERENCE</p><h1>View crop reference directions with the soil in mind.</h1><p className="page-lead">This tool provides reference crop directions from the available local ruleset. It is not an AI prediction, best-crop claim, or agronomic diagnosis.</p><div className="recommendation-only-panel"><div className="recommendation-only-copy"><p className="section-kicker">LOCAL REFERENCE RULESET</p><h2>Start with two known inputs.</h2><p>Select a crop to view its reference direction for the selected soil type. Review local conditions and real soil-test results before acting.</p><Link href="/guide/soil-types" className="text-link">Read soil types <ArrowRight size={15}/></Link></div><div className="recommendation-controls"><label>Soil type<select value={soil} onChange={(event) => setSoil(event.target.value)}><option value="" disabled>Select soil type</option>{soilOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Crop type<select value={crop} onChange={(event) => setCrop(event.target.value)}><option value="" disabled>Select crop type</option>{cropOptions.map((item) => <option key={item}>{item}</option>)}</select></label>{guidance.status === "available" ? <div className="recommendation-result reference-result"><span>Reference direction</span><strong>{guidance.entry.referenceDirection}</strong><p><strong>Selected soil:</strong> {soil}</p><p><strong>Selected crop:</strong> {crop}</p><p className="reference-provenance"><strong>Source:</strong> {guidance.entry.source}</p><p className="reference-limit"><strong>Limitation:</strong> {guidance.entry.limitations}</p></div> : <div className="empty-result recommendation-empty"><Leaf size={22}/><div><strong>{guidance.status === "incomplete" ? "Select field context" : "No reference direction available"}</strong><p>{guidance.message}</p></div></div>}</div></div></div></section></PageFrame>;
}

function ChatbotPage() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");

  const sendQuestion = async (event, retryQuestion = "") => {
    event?.preventDefault();
    const nextQuestion = (retryQuestion || question).trim();
    if (!nextQuestion || status === "loading") return;
    const history = messages.slice(-10).map((item) => ({ role: item.role, content: item.content }));
    setMessages((items) => [...items, { role: "user", content: nextQuestion }]);
    setQuestion("");
    setLastQuestion(nextQuestion);
    setError("");
    setStatus("loading");
    try {
      const answer = await askFarmerChatbot({ question: nextQuestion, history });
      setMessages((items) => [...items, { role: "assistant", content: answer }]);
      setStatus("ready");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the AI service. Please try again.");
      setStatus("error");
    }
  };

  return <PageFrame footer="agricultural"><section className="chatbot-page"><div className="content-width chatbot-head"><div><p className="eyebrow">KRISHAK AI / FARMER ASSISTANT</p><h1>Ask a practical farming question.</h1><p className="page-lead">An AI-powered information assistant for cultivation, soil, irrigation, crop planning, and general agricultural practice.</p></div><div className="chatbot-boundary"><span>SERVER-SIDE AI</span><strong>Question → Krishak backend → Gemini → Answer</strong><small>Your API key stays on the server.</small></div></div><div className="content-width chatbot-layout"><section className="chatbot-panel" aria-label="Krishak AI conversation"><div className="chatbot-messages" aria-live="polite">{messages.length === 0 && <div className="chatbot-empty-state"><span className="chat-message-label">KRISHAK AI</span><strong>Start with a field question.</strong><p>Ask about crops, soil, irrigation, fertilizer concepts, pests, or general farming practices.</p></div>}{messages.map((item, index) => <article className={`chat-message chat-message--${item.role}`} key={`${item.role}-${index}`}><span className="chat-message-label">{item.role === "assistant" ? "KRISHAK AI" : "YOU"}</span>{item.role === "assistant" ? <div className="chat-message-content"><Streamdown>{item.content}</Streamdown></div> : <p className="chat-message-content chat-message-content--plain">{item.content}</p>}</article>)}{status === "loading" && <article className="chat-message chat-message--assistant chat-message--loading"><span className="chat-message-label">KRISHAK AI</span><p>Thinking through the field context…</p></article>}</div><form className="chatbot-form" onSubmit={sendQuestion}><label htmlFor="farmer-question">Your question</label><div className="chatbot-input-row"><textarea id="farmer-question" rows="3" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendQuestion(event); } }} placeholder="For example: How can I prepare loamy soil before sowing wheat?" disabled={status === "loading"} maxLength={2000}/><button className="button button--leaf" type="submit" disabled={status === "loading" || !question.trim()}>{status === "loading" ? "Thinking…" : "Send"} <ArrowRight size={15}/></button></div><div className="chatbot-form-meta"><span>{question.length}/2000 characters</span><span>Enter to send · Shift+Enter for new line</span></div></form>{status === "error" && <div className="service-state service-state--error" role="alert"><X size={21}/><div><strong>We could not complete that question.</strong><p>{error}</p><button className="text-button" type="button" onClick={(event) => sendQuestion(event, lastQuestion)}>Retry</button></div></div>}</section><aside className="chatbot-notes"><p className="section-kicker">USE IT WITH CARE</p><h2>Useful context, not certified advice.</h2><p>Krishak AI can explain general agricultural concepts, but it does not inspect your field or replace a local expert, laboratory, extension service, or product label.</p><div className="chatbot-topics"><span>Crop cultivation</span><span>Soil and nutrients</span><span>Irrigation</span><span>Pests and disease context</span></div></aside></div></section></PageFrame>;
}

function DiseaseFarmIntrusionOverviewPage() {
  const { t } = useLanguage();
  const scrollToTools = () => {
    const target = document.getElementById("farm-safety-features");
    if (!target) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  };
  return <PageFrame>
    <main className="farm-safety-overview">
      <section className="farm-safety-overview__hero content-width">
        <div>
          <p className="eyebrow">{t("KRISHAK / FARM PROTECTION")}</p>
          <h1>{t("Disease Detection & Farm Intrusion")}</h1>
          <p className="page-lead">{t("Check crop images for possible disease and monitor your farm for possible animal or person intrusion.")}</p>
          <button className="button button--leaf" type="button" onClick={scrollToTools}>{t("Get Started")} <ArrowRight size={15} /></button>
        </div>
        <div className="farm-safety-overview__badge" aria-hidden="true"><Leaf size={34} /><ShieldCheck size={34} /></div>
      </section>
      <section className="farm-safety-overview__tools content-width" id="farm-safety-features" tabIndex="-1">
        <p className="section-kicker">{t("CHOOSE A FARM SAFETY TOOL")}</p>
        <div className="farm-safety-overview__grid">
          <article className="farm-safety-card farm-safety-card--disease">
            <Leaf size={24} aria-hidden="true" />
            <h2>{t("Disease Detection")}</h2>
            <p>{t("Upload a crop image to check for possible plant diseases.")}</p>
            <Link href="/disease-detection" className="button button--leaf">{t("Open Detection")} <ArrowRight size={15} /></Link>
          </article>
          <article className="farm-safety-card farm-safety-card--intrusion">
            <ShieldCheck size={24} aria-hidden="true" />
            <h2>{t("Animal & Farm Intrusion")}</h2>
            <p>{t("Monitor possible animals or people entering the farm area.")}</p>
            <Link href="/animal-intrusion" className="button button--gold">{t("Open Monitoring")} <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>
    </main>
  </PageFrame>;
}

function NotFoundPage() { return <PageFrame><section className="not-found-page"><div className="content-width"><p className="eyebrow">KRISHAK / 404</p><h1>This field path does not exist.</h1><p className="page-lead">The page may have moved, or the route may not be part of the approved Krishak application.</p><Link href="/" className="button button--leaf">Return home <ArrowRight size={15}/></Link></div></section></PageFrame>; }

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
// Access: requires login (RequireCommunityAuth) + admin role (checked below).
// All complaint data is real, fetched from the community backend.
// Admin endpoints enforce role server-side; this is only the frontend guard.

function AdminDashboardPage() {
  const { token, user, logout } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [listStatus, setListStatus] = useState("idle");
  const [listMessage, setListMessage] = useState("");
  const [selected, setSelected] = useState(null); // full complaint detail
  const [detailStatus, setDetailStatus] = useState("idle");
  const [detailMessage, setDetailMessage] = useState("");
  const [solutionDraft, setSolutionDraft] = useState("");
  const [actionStatus, setActionStatus] = useState("idle");
  const [actionMessage, setActionMessage] = useState("");
  const [adminView, setAdminView] = useState("dashboard"); // dashboard | farmers | farmer-detail
  const [farmers, setFarmers] = useState([]);
  const [farmersStatus, setFarmersStatus] = useState("idle");
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [farmerComplaints, setFarmerComplaints] = useState([]);
  const [farmerComplaintsStatus, setFarmerComplaintsStatus] = useState("idle");
  const [metrics, setMetrics] = useState({ farmerCount: 0, totalComplaints: 0, pending: 0, resolved: 0 });
  const [, navigate] = useLocation();

  // Redirect non-admins immediately after auth resolves.
  useEffect(() => { if (user && user.role !== "admin") navigate("/"); }, [user, navigate]);

  const loadAll = async () => {
    if (!token) return;
    setListStatus("loading"); setListMessage("");
    try {
      const [data, stats] = await Promise.all([getAdminComplaints(token), getAdminStats(token)]);
      setComplaints(data.complaints || []);
      setMetrics({ farmerCount: Number(stats.farmerCount || 0), totalComplaints: Number(stats.totalComplaints || 0), pending: Number(stats.pending || 0), resolved: Number(stats.resolved || 0) });
      setListStatus("ready");
    } catch (err) { setListStatus("error"); setListMessage(err.message); }
  };

  useEffect(() => { if (token && user?.role === "admin") loadAll(); }, [token, user]);

  const loadFarmers = async () => {
    setFarmersStatus("loading");
    try {
      const data = await getAdminFarmers(token);
      setFarmers(data.farmers || []);
      setFarmersStatus("ready");
    } catch (err) { setFarmersStatus("error"); setListMessage(err.message); }
  };

  const openFarmerDetail = async (farmer) => {
    setSelectedFarmer(farmer);
    setFarmerComplaintsStatus("loading");
    setAdminView("farmer-detail");
    try {
      const data = await getAdminFarmerComplaints(farmer.id, token);
      setFarmerComplaints(data.complaints || []);
      setFarmerComplaintsStatus("ready");
    } catch { setFarmerComplaintsStatus("error"); }
  };

  const openDetail = async (id) => {
    setDetailStatus("loading"); setDetailMessage(""); setSelected(null); setSolutionDraft(""); setActionMessage("");
    try {
      const data = await getComplaint(id, token);
      setSelected(data.complaint);
      setSolutionDraft(data.complaint.solution || "");
      setDetailStatus("ready");
    } catch (err) { setDetailStatus("error"); setDetailMessage(err.message); }
  };

  const saveSolution = async () => {
    if (!selected) return;
    setActionStatus("saving"); setActionMessage("");
    try {
      await updateComplaint(selected.id, { solution: solutionDraft }, token);
      setSelected((c) => ({ ...c, solution: solutionDraft }));
      setComplaints((cs) => cs.map((c) => c.id === selected.id ? { ...c, solution: solutionDraft } : c));
      setActionStatus("idle"); setActionMessage("Solution saved.");
    } catch (err) { setActionStatus("idle"); setActionMessage(err.message); }
  };

  const markStatus = async (newStatus) => {
    if (!selected) return;
    setActionStatus("updating"); setActionMessage("");
    try {
      if (newStatus === "resolved" && !solutionDraft.trim()) { setActionStatus("idle"); setActionMessage("A solution is required before resolving a complaint."); return; }
      const payload = { status: newStatus };
      if (newStatus === "resolved") payload.solution = solutionDraft.trim();
      const data = await updateComplaint(selected.id, payload, token);
      const updated = data.complaint;
      setSelected(updated);
      setComplaints((cs) => cs.map((c) => c.id === updated.id ? updated : c));
      const stats = await getAdminStats(token);
      setMetrics({ farmerCount: Number(stats.farmerCount || 0), totalComplaints: Number(stats.totalComplaints || 0), pending: Number(stats.pending || 0), resolved: Number(stats.resolved || 0) });
      setActionStatus("idle"); setActionMessage(`Status updated to "${newStatus}".`);
    } catch (err) { setActionStatus("idle"); setActionMessage(err.message); }
  };

  const removeComplaint = async (id) => {
    if (!window.confirm("Permanently delete this complaint? This cannot be undone.")) return;
    setActionStatus("deleting"); setActionMessage("");
    try {
      await deleteComplaint(id, token);
      setComplaints((cs) => cs.filter((c) => c.id !== id));
      if (selected?.id === id) { setSelected(null); setDetailStatus("idle"); }
      const stats = await getAdminStats(token);
      setMetrics({ farmerCount: Number(stats.farmerCount || 0), totalComplaints: Number(stats.totalComplaints || 0), pending: Number(stats.pending || 0), resolved: Number(stats.resolved || 0) });
      setActionStatus("idle"); setActionMessage("Complaint deleted.");
    } catch (err) { setActionStatus("idle"); setActionMessage(err.message); }
  };

  const totalCount = metrics.totalComplaints;
  const pendingCount = metrics.pending;
  const resolvedCount = metrics.resolved;

  if (!user) return null;
  if (user.role !== "admin") return null;

  return (
    <PageFrame>
      <section className="admin-dashboard">
        <div className="content-width">
          <div className="admin-heading-row"><div><p className="eyebrow">KRISHAK / ADMIN</p><h1>Admin Complaint Dashboard</h1><p className="page-lead">Complaint metrics, actions, and Farmer records come from the authenticated community backend.</p></div><button className="text-button" type="button" onClick={async () => { try { await logout(); } finally { navigate("/login"); } }}>Log out</button></div>
          <div className="admin-metrics">
            <div className="admin-metric"><span>Total Complaints</span><strong>{totalCount}</strong></div>
            <div className="admin-metric admin-metric--pending"><span>Pending</span><strong>{pendingCount}</strong></div>
            <div className="admin-metric admin-metric--resolved"><span>Resolved</span><strong>{resolvedCount}</strong></div>
            <button className="admin-metric admin-metric--farmers" type="button" onClick={() => { setAdminView("farmers"); if (farmersStatus === "idle") loadFarmers(); }} aria-label="View registered farmers list">
              <span>Registered Farmers</span><strong>{metrics.farmerCount}</strong>
            </button>
          </div>
          {adminView === "farmers" && (
            <div className="admin-farmers-panel">
              <div className="admin-list-head"><p className="section-kicker">REGISTERED FARMERS</p><button className="text-button" onClick={() => setAdminView("dashboard")}>Back to complaints</button></div>
              {farmersStatus === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Loading farmers…</strong></div></div>}
              {farmersStatus === "error" && <div className="service-state service-state--error"><X size={20}/><div><strong>Could not load farmer list</strong><p>{listMessage}</p></div></div>}
              {farmersStatus === "ready" && farmers.length === 0 && <div className="empty-result"><ShieldCheck size={22}/><div><strong>No registered farmers yet.</strong></div></div>}
              {farmersStatus === "ready" && farmers.map((farmer) => (
                <button key={farmer.id} className="admin-complaint-row" onClick={() => openFarmerDetail(farmer)} aria-label={`View details for ${farmer.name}`}>
                  <div className="admin-complaint-row-head"><strong>{farmer.name}</strong><span className="complaint-badge">{farmer.role}</span></div>
                  <p>{farmer.email} · Complaints: {farmer.complaintCount ?? 0}</p>
                </button>
              ))}
            </div>
          )}
          {adminView === "farmer-detail" && selectedFarmer && (
            <div className="admin-farmer-detail">
              <div className="admin-list-head"><p className="section-kicker">FARMER DETAILS</p><button className="text-button" onClick={() => { setAdminView("farmers"); setSelectedFarmer(null); }}>Back to list</button></div>
              <div className="admin-farmer-info"><div><span>Name</span><strong>{selectedFarmer.name}</strong></div><div><span>Email</span><strong>{selectedFarmer.email}</strong></div>{selectedFarmer.created_at && <div><span>Registered</span><strong>{new Date(selectedFarmer.created_at).toLocaleDateString()}</strong></div>}</div>
              <p className="section-kicker" style={{marginTop:"1rem"}}>FARMER COMPLAINTS</p>
              {farmerComplaintsStatus === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Loading complaints…</strong></div></div>}
              {farmerComplaintsStatus === "error" && <div className="service-state service-state--error"><X size={20}/><div><strong>Could not load complaints</strong></div></div>}
              {farmerComplaintsStatus === "ready" && farmerComplaints.length === 0 && <div className="empty-result"><ShieldCheck size={22}/><div><strong>No complaints from this farmer.</strong></div></div>}
              {farmerComplaintsStatus === "ready" && farmerComplaints.map((c) => (
                <button key={c.id} className="admin-complaint-row" onClick={() => { setAdminView("dashboard"); openDetail(c.id); }}>
                  <div className="admin-complaint-row-head"><strong>{c.subject}</strong><span className={`complaint-badge complaint-badge--${c.status}`}>{c.status}</span></div>
                  <p>{c.category} · {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</p>
                </button>
              ))}
            </div>
          )}
          {listStatus === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Complaint queue unavailable</strong><p>{listMessage}</p></div></div>}
          <div className="admin-layout">
            <div className="admin-list-panel">
              <div className="admin-list-head"><p className="section-kicker">COMPLAINT QUEUE</p><button className="button button--ochre" onClick={loadAll} disabled={listStatus === "loading"}>{listStatus === "loading" ? "Loading…" : "Refresh"}</button></div>
              {listStatus === "ready" && complaints.length === 0 && <div className="empty-result"><ShieldCheck size={22}/><div><strong>No complaints yet.</strong><p>All complaints submitted by farmers will appear here.</p></div></div>}
              {complaints.map((c) => (
                <button key={c.id} className={`admin-complaint-row${selected?.id === c.id ? " admin-complaint-row--active" : ""}`} onClick={() => openDetail(c.id)}>
                  <div className="admin-complaint-row-head"><strong>{c.subject}</strong><span className={`complaint-badge complaint-badge--${c.status}`}>{c.status}</span></div>
                  <p>{c.farmerName || "Farmer"} · {c.category}</p>
                </button>
              ))}
            </div>
            <div className="admin-detail-panel">
              {!selected && detailStatus !== "loading" && detailStatus !== "error" && <div className="empty-result"><ShieldCheck size={22}/><div><strong>Select a complaint to view details.</strong></div></div>}
              {detailStatus === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Loading complaint…</strong></div></div>}
              {detailStatus === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Could not load complaint</strong><p>{detailMessage}</p></div></div>}
              {selected && detailStatus === "ready" && (
                <div className="admin-detail">
                  <div className="admin-detail-header">
                    <div>
                      <p className="eyebrow">{selected.category}</p>
                      <h2>{selected.subject}</h2>
                      <p className="admin-farmer-meta">{selected.farmerName} · {selected.farmerEmail}</p>
                    </div>
                    <span className={`complaint-badge complaint-badge--${selected.status}`}>{selected.status}</span>
                  </div>
                  <div className="admin-detail-body">
                    <p className="section-kicker">COMPLAINT DESCRIPTION</p>
                    <p>{selected.description}</p>
                    {selected.location && <p><strong>Location:</strong> {selected.location}</p>}
                    <p className="admin-meta-time">Submitted {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "Unknown"}</p>
                  </div>
                  <div className="admin-solution-section">
                    <p className="section-kicker">ADMIN SOLUTION / RESPONSE</p>
                    <label>Solution<textarea rows="4" value={solutionDraft} onChange={(e) => setSolutionDraft(e.target.value)} placeholder="Write a resolution or guidance for the farmer…" maxLength={5000}/></label>
                    <button className="button button--leaf" onClick={saveSolution} disabled={actionStatus === "saving" || actionStatus === "deleting"}>{actionStatus === "saving" ? "Saving…" : "Save solution"}</button>
                  </div>
                  <div className="admin-action-bar">
                    <p className="section-kicker">CHANGE STATUS</p>
                    <div className="admin-actions">
                      <button className="button button--ochre" onClick={() => markStatus("in_review")} disabled={selected.status === "in_review" || actionStatus !== "idle"}>Mark In Review</button>
                      <button className="button button--leaf" onClick={() => markStatus("resolved")} disabled={selected.status === "resolved" || actionStatus !== "idle"}>Mark Resolved</button>
                      <button className="text-button text-button--danger" onClick={() => removeComplaint(selected.id)} disabled={actionStatus !== "idle"}>{actionStatus === "deleting" ? "Deleting…" : "Delete complaint"}</button>
                    </div>
                  </div>
                  {actionMessage && <p className={`admin-action-msg${actionMessage.startsWith("Error") || actionMessage.startsWith("The") ? " admin-action-msg--error" : ""}`}>{actionMessage}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}


// ---- Market page helpers (state/UT dropdown + commodity suggestions) ----
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
const COMMON_COMMODITIES = [
  "Wheat", "Rice", "Paddy", "Maize", "Bajra", "Jowar", "Barley",
  "Arhar (Tur)", "Moong (Green Gram)", "Urad (Black Gram)", "Chana",
  "Masoor (Lentil)", "Rajma",
  "Groundnut", "Mustard", "Soybean", "Sunflower", "Sesame", "Linseed",
  "Cotton", "Sugarcane", "Jute",
  "Onion", "Potato", "Tomato", "Garlic", "Chilli", "Ginger", "Turmeric",
  "Coriander", "Cumin (Jeera)", "Fenugreek (Methi)",
  "Cauliflower", "Cabbage", "Carrot", "Radish", "Peas", "Brinjal", "Okra",
  "Banana", "Mango", "Apple", "Orange", "Grapes", "Pomegranate",
  "Guava", "Watermelon", "Papaya",
];

function MarketPricesPage() {
  const [filters, setFilters] = useState({ commodity: "", state: "", district: "" });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [records, setRecords] = useState([]);
  const [fetchedAt, setFetchedAt] = useState("");

  const update = (key) => (e) => setFilters(f => ({ ...f, [key]: e.target.value }));

  const load = async (e) => {
    if (e) e.preventDefault();
    setStatus("loading"); setMessage(""); setCode(""); setRecords([]);
    try {
      const data = await fetchMarketPrices({ ...filters });
      setRecords(data.records || []);
      setFetchedAt(data.fetched_at || "");
      setStatus("ready");
    } catch (error) {
      setCode(error.code || "");
      setMessage(error.message || "Market price service unavailable.");
      setStatus("error");
    }
  };

  const formatPrice = (n) => (Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—");

  return (
    <PageFrame footer="agricultural">
      <section className="market-prices-page">
        <div className="content-width market-head">
          <div>
            <p className="eyebrow">MARKET / KRISHAK</p>
            <h1>Mandi Market Prices</h1>
            <p className="page-lead">Check current commodity prices at agricultural markets. Data sourced from Agmarknet (data.gov.in) when configured.</p>
          </div>
          <div className="market-badge"><IndianRupee size={38}/></div>
        </div>
        <div className="content-width">
          <form className="market-form" onSubmit={load}>
            <p className="section-kicker">01 / FILTER</p>
            <div className="market-filters">
              <label>
                Commodity
                <input list="market-commodity-list" value={filters.commodity} onChange={update("commodity")} placeholder="e.g. Wheat, Onion" autoComplete="off"/>
                <datalist id="market-commodity-list">{COMMON_COMMODITIES.map(c => <option key={c} value={c}/>)}</datalist>
              </label>
              <label>
                State / UT
                <select value={filters.state} onChange={update("state")}>
                  <option value="">All States / UTs</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                District
                <input value={filters.district} onChange={update("district")} placeholder="Enter a district" autoComplete="off"/>
              </label>
            </div>
            <button className="button button--leaf" type="submit" disabled={status === "loading"}>{status === "loading" ? "Loading…" : "Check Prices"} <ArrowRight size={15}/></button>
          </form>

          <div className="market-results">
            {status === "idle" && (
              <div className="empty-result empty-result--wide">
                <IndianRupee size={28}/>
                <div><strong>Enter a commodity or filter and check prices.</strong><p>Prices require the DATA_GOV_API_KEY to be configured on the server.</p></div>
              </div>
            )}
            {status === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Fetching market prices…</strong><p>Requesting data from Agmarknet via the server.</p></div></div>}
            {status === "error" && (
              <div className="service-state service-state--error">
                <X size={22}/>
                <div>
                  <strong>{code === "NOT_CONFIGURED" ? "Market data not configured" : "Price service unavailable"}</strong>
                  <p>{message}</p>
                  {code === "NOT_CONFIGURED" && <p className="market-config-note">Add <code>DATA_GOV_API_KEY</code> to the server environment to enable live mandi prices. Get a free key at <a href="https://data.gov.in" target="_blank" rel="noopener noreferrer">data.gov.in</a>.</p>}
                </div>
              </div>
            )}
            {status === "ready" && records.length === 0 && (
              <div className="empty-result empty-result--wide">
                <IndianRupee size={26}/>
                <div><strong>No records found for this filter.</strong><p>Try a different commodity, state, or district.</p></div>
              </div>
            )}
            {status === "ready" && records.length > 0 && (
              <>
                <p className="market-meta">Showing {records.length} records. Last updated: {fetchedAt ? new Date(fetchedAt).toLocaleString() : "—"}. Source: Agmarknet / data.gov.in.</p>
                <div className="market-table-wrap" role="region" aria-label="Market prices table">
                  <table className="market-table">
                    <thead><tr><th scope="col">Commodity</th><th scope="col">Market</th><th scope="col">District</th><th scope="col">Date</th><th scope="col">Min</th><th scope="col">Max</th><th scope="col">Modal</th></tr></thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={i}>
                          <td>{r.commodity}{r.variety ? ` (${r.variety})` : ""}</td>
                          <td>{r.market}</td>
                          <td>{r.district}</td>
                          <td>{r.arrivalDate}</td>
                          <td className="market-price">{formatPrice(r.minPrice)}</td>
                          <td className="market-price">{formatPrice(r.maxPrice)}</td>
                          <td className="market-price market-price--modal">{formatPrice(r.modalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
function RoutedPage({ path }) {
  if (path === "/") return <MainHub />;

  if (path === "/community") return <CommunityLandingPage />;
  if (path === "/community/discussion-forum")
    return <PageFrame><CommunityDiscussionForum /></PageFrame>;
  if (path === "/community/discussion-forum/create")
    return <CreateDiscussionPage />;
  if (path === "/community/discussion-forum/details")
    return <PageFrame><CommunityDiscussionDetails /></PageFrame>;
  if (path === "/community/community-events")
    return <EventsPage />;
  if (path === "/community/community-events/details")
    return <EventDetailsPage />;
  if (path === "/community/sikayat-kendra")
    return <SikayatKendraPage />;

  if (path === "/login") return <AuthPage mode="login" />;
  if (path === "/signup") return <AuthPage mode="signup" />;

  if (path === "/resources")
    return <RequireCommunityAuth path="/resources"><ResourcesPage /></RequireCommunityAuth>;

  if (path === "/profile")
    return <RequireCommunityAuth path="/profile"><ProfilePage /></RequireCommunityAuth>;

  if (path === "/guide")
    return <RequireCommunityAuth path="/guide"><GuideIndexPage /></RequireCommunityAuth>;

  if (path === "/guide/soil-testing")
    return <RequireCommunityAuth path="/guide/soil-testing"><SoilTestingPage /></RequireCommunityAuth>;

  if (path === "/guide/hybrid-seed")
    return <RequireCommunityAuth path="/guide/hybrid-seed"><HybridSeedPage /></RequireCommunityAuth>;

  if (path === "/guide/fertilizers")
    return <RequireCommunityAuth path="/guide/fertilizers"><FertilizersPage /></RequireCommunityAuth>;

  if (path === "/guide/soil-types")
    return <RequireCommunityAuth path="/guide/soil-types"><SoilTypesPage /></RequireCommunityAuth>;

  if (path === "/guide/crop-recommendation")
    return <RequireCommunityAuth path="/guide/crop-recommendation"><CropRecommendationPage /></RequireCommunityAuth>;

  if (path === "/planner")
    return <RequireCommunityAuth path="/planner"><IrrigationPlannerPage /></RequireCommunityAuth>;

  if (path === "/weather")
    return <RequireCommunityAuth path="/weather"><WeatherPage /></RequireCommunityAuth>;

  if (path === "/disease-farm-intrusion")
    return <RequireCommunityAuth path="/disease-farm-intrusion"><DiseaseFarmIntrusionOverviewPage /></RequireCommunityAuth>;

  if (path === "/disease-detection")
    return <RequireCommunityAuth path="/disease-detection"><ImageDetectionPage kind="disease" /></RequireCommunityAuth>;

  if (path === "/animal-intrusion")
    return <RequireCommunityAuth path="/animal-intrusion"><ImageDetectionPage kind="intrusion" /></RequireCommunityAuth>;

  if (path === "/soil-analysis")
    return <RequireCommunityAuth path="/soil-analysis"><SoilAnalysisPage /></RequireCommunityAuth>;

  if (path === "/chatbot")
    return <RequireCommunityAuth path="/chatbot"><ChatbotPage /></RequireCommunityAuth>;

  if (path === "/market-prices")
    return <RequireCommunityAuth path="/market-prices"><MarketPricesPage /></RequireCommunityAuth>;

  if (path === "/admin")
    return <RequireCommunityAuth path="/admin" requiredRole="admin"><AdminDashboardPage /></RequireCommunityAuth>;

  return <PlaceholderPage path={path} />;
}

export default function App() {
  return <ThemeProvider switchable={true}><LanguageProvider><AuthProvider><Switch>{[
    "/", "/planner", "/weather", "/disease-farm-intrusion", "/disease-detection",
    "/animal-intrusion", "/soil-analysis", "/community-forum", "/guide",
    "/guide/soil-testing", "/guide/hybrid-seed", "/guide/fertilizers",
    "/guide/soil-types", "/community", "/community/discussion-forum",
    "/community/sikayat-kendra", "/community/community-events", "/resources",
    "/community/discussion-forum/create", "/community/discussion-forum/details",
    "/community/community-events/details", "/login", "/signup", "/profile",
    "/guide/crop-recommendation", "/chatbot", "/admin", "/market-prices",
  ].map((path) => <Route key={path} path={path}><RoutedPage path={path} /></Route>)}<Route><NotFoundPage /></Route></Switch></AuthProvider></LanguageProvider></ThemeProvider>;
}