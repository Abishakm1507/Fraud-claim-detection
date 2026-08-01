import React, { useState, useMemo } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Search,
  ShieldAlert,
  CheckCircle,
  Activity,
  AlertTriangle,
  FileText,
  Briefcase,
  Sparkles,
  Download,
  ChevronUp,
  ChevronDown,
  Info,
  Building2,
  Stethoscope,
  HeartPulse,
  Brain,
  XCircle,
  Eye,
  EyeOff,
  ArrowUpDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const API_URL = 'http://127.0.0.1:8000';

/* ------------------------------------------------------------------ */
/* Circular progress for Fraud Score                                   */
/* ------------------------------------------------------------------ */
const CircularProgress = ({ value }) => {
  const percentage = Math.min(100, Math.max(0, value || 0));
  const radius = 60;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let strokeColor = 'stroke-emerald-500';
  if (percentage >= 80) strokeColor = 'stroke-rose-500';
  else if (percentage >= 50) strokeColor = 'stroke-amber-500';

  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          className="stroke-slate-100"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          className={`${strokeColor} transition-all duration-500 ease-out`}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-slate-800">{percentage.toFixed(1)}%</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fraud Score</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Collapsible Developer View for raw JSON                              */
/* ------------------------------------------------------------------ */
const DeveloperView = ({ data, label = 'Raw JSON Data' }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors font-bold text-slate-700 focus:outline-none"
      >
        <span className="text-sm uppercase tracking-wider flex items-center gap-2">
          {isOpen ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
          Developer View — {label}
        </span>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="p-6 border-t border-slate-200 bg-slate-900 overflow-x-auto max-h-[500px]">
          <pre className="text-xs text-emerald-400 font-mono leading-relaxed p-2 select-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Agent Card                                                          */
/* ------------------------------------------------------------------ */
const AgentMetaCard = ({ title, icon, summary, riskScore, severity, confidence, recommendation, evidence }) => {
  const scorePct = riskScore !== undefined && riskScore !== null ? riskScore * 100 : null;

  const severityClass =
    severity === 'high'
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : severity === 'medium'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  const riskBadgeClass =
    scorePct >= 80
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : scorePct >= 50
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md hover:shadow-lg transition-shadow flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner shrink-0">
            {icon}
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">{title}</h4>
            <p className="text-xs text-slate-400 font-semibold">Specialist risk analysis</p>
          </div>
        </div>
        {scorePct !== null && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${riskBadgeClass}`}>
            Risk: {scorePct.toFixed(0)}%
          </span>
        )}
      </div>

      {summary && (
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Summary</p>
          <p className="text-sm text-slate-600 font-medium leading-relaxed mt-1">{summary}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {severity && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Severity</span>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${severityClass}`}>
              {severity}
            </span>
          </div>
        )}
        {confidence !== undefined && confidence !== null && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Confidence</span>
            <span className="text-sm font-extrabold text-slate-800 block mt-1">
              {typeof confidence === 'number' ? `${(confidence * 100).toFixed(1)}%` : confidence}
            </span>
          </div>
        )}
      </div>

      {recommendation && (
        <div className="mt-auto pt-4 border-t border-slate-100 mb-4">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Recommendation</p>
          <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">{recommendation}</p>
        </div>
      )}

      {evidence && evidence.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Evidence Flags ({evidence.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {evidence.map((item, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  item?.signal === 'elevated'
                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                    : item?.signal === 'outlier_low'
                      ? 'bg-amber-50 text-amber-600 border-amber-100'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {item?.metric || '—'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Coordinator Card                                                    */
/* ------------------------------------------------------------------ */
const CoordinatorCard = ({ coordinator, recommendations }) => {
  const fraudScore = coordinator?.['Fraud Score'];
  const riskScore = coordinator?.risk_score;
  const score = fraudScore ?? riskScore;
  const scorePct = score !== undefined && score !== null ? (score <= 1 ? score * 100 : score) : null;
  const riskTier = coordinator?.risk_tier;
  const confidence = coordinator?.Confidence ?? coordinator?.confidence;
  const priority = coordinator?.Priority ?? coordinator?.priority;

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-950 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500 rounded-full mix-blend-screen filter blur-[80px] opacity-10 pointer-events-none"></div>

      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10 relative z-10">
        <h4 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" /> Coordinator Agent
        </h4>
        {scorePct !== null && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/10">
            Overall: {scorePct.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
        {scorePct !== null && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fraud Score</span>
            <span className="text-xl font-black text-white mt-1 block">{scorePct.toFixed(1)}%</span>
          </div>
        )}
        {riskTier && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk Level</span>
            <span className={`text-sm font-extrabold capitalize mt-1 block ${
              riskTier === 'high' ? 'text-rose-400' : riskTier === 'medium' ? 'text-amber-400' : 'text-emerald-400'
            }`}>{riskTier}</span>
          </div>
        )}
        {confidence !== undefined && confidence !== null && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confidence</span>
            <span className="text-sm font-extrabold text-indigo-300 mt-1 block">
              {typeof confidence === 'number' ? `${(confidence * 100).toFixed(1)}%` : confidence}
            </span>
          </div>
        )}
        {priority && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Priority</span>
            <span className="text-sm font-extrabold mt-1 block">{priority}</span>
          </div>
        )}
      </div>

      {recommendations && recommendations.length > 0 && (
        <div className="relative z-10">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Coordinator Recommendations</p>
          <ul className="space-y-2">
            {recommendations.slice(0, 4).map((rec, index) => (
              <li key={index} className="text-xs bg-white/5 border border-white/5 p-2.5 rounded-lg text-slate-300 flex items-start gap-2">
                <span className="text-indigo-400 font-bold shrink-0">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */
const ProviderInvestigation = () => {
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [investigateData, setInvestigateData] = useState(null);
  const [explainData, setExplainData] = useState(null);
  const [error, setError] = useState('');
  const [explainError, setExplainError] = useState('');

  // Evidence table controls
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('agent');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const handleInvestigate = async (e) => {
    e.preventDefault();
    if (!providerId.trim()) return;

    setLoading(true);
    setError('');
    setExplainError('');
    setInvestigateData(null);
    setExplainData(null);
    setPage(1);

    const formattedId = providerId.trim();

    try {
      // Fire both API calls concurrently
      const [investigateRes, explainRes] = await Promise.allSettled([
        axios.post(`${API_URL}/investigate`, { provider_id: formattedId }),
        axios.get(`${API_URL}/explain/${formattedId}`)
      ]);

      if (investigateRes.status === 'fulfilled') {
        setInvestigateData(investigateRes.value?.data);
      } else {
        console.error('Investigation Error:', investigateRes.reason);
        setError('Unable to retrieve investigation. Please verify the Provider ID.');
      }

      if (explainRes.status === 'fulfilled') {
        setExplainData(explainRes.value?.data);
      } else {
        console.error('Explainability Error:', explainRes.reason);
        setExplainError('Explainability is temporarily unavailable. Investigation results are still available.');
      }
    } catch (err) {
      console.error('Unexpected Error:', err);
      setError('Unable to retrieve investigation. Please verify the Provider ID.');
    } finally {
      setLoading(false);
    }
  };

  /* ------------- Derived investigation values ------------- */
  const coordinator = investigateData?.investigation_summary?.coordinator || {};

  const fraudProbability = investigateData?.fraud_probability ?? coordinator?.fraud_probability;

  const rawFraudScore =
    coordinator?.['Fraud Score'] ??
    coordinator?.risk_score ??
    investigateData?.fraud_probability;

  let fraudScorePercent = null;
  if (rawFraudScore !== undefined && rawFraudScore !== null) {
    fraudScorePercent = rawFraudScore <= 1.0 ? rawFraudScore * 100 : rawFraudScore;
  }

  const riskTier = coordinator?.risk_tier;
  const confidence = coordinator?.Confidence ?? coordinator?.confidence;
  const priority = coordinator?.Priority ?? coordinator?.priority;

  const isFraud = fraudProbability !== undefined && fraudProbability !== null
    ? fraudProbability >= 0.5
    : (fraudScorePercent !== null ? fraudScorePercent >= 50 : null);

  /* ------------- Merged evidence ------------- */
  const mergedEvidence = useMemo(() => {
    const providerEvidence = investigateData?.investigation_summary?.provider?.evidence || [];
    const claimEvidence = investigateData?.investigation_summary?.claim?.evidence || [];
    const beneficiaryEvidence = investigateData?.investigation_summary?.beneficiary?.evidence || [];

    return [
      ...providerEvidence.map((item) => ({ ...item, agent: 'Provider' })),
      ...claimEvidence.map((item) => ({ ...item, agent: 'Claim' })),
      ...beneficiaryEvidence.map((item) => ({ ...item, agent: 'Beneficiary' }))
    ];
  }, [investigateData]);

  // Search + Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = mergedEvidence.filter((item) => {
      return (
        (item?.agent || '').toLowerCase().includes(q) ||
        (item?.metric || '').toLowerCase().includes(q) ||
        (item?.signal || '').toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
    return sorted;
  }, [mergedEvidence, searchQuery, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedEvidence = filteredAndSorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-4 h-4 ml-1 text-indigo-600" />
      : <ChevronDown className="w-4 h-4 ml-1 text-indigo-600" />;
  };

  /* ------------- Recommendations ------------- */
  const recommendations =
    coordinator?.Recommendation ??
    coordinator?.recommended_actions ??
    [];

  /* ------------- SHAP data ------------- */
  const shapSummary = explainData?.structured_explanation?.summary ?? explainData?.shap_summary;
  const shapFeatures = explainData?.structured_explanation?.features ?? explainData?.feature_importance ?? [];
  const summaryPlot = explainData?.plots?.summary_plot;
  const waterfallPlot = explainData?.plots?.waterfall_plot;

  const chartData = useMemo(() => {
    const features = explainData?.structured_explanation?.features ?? explainData?.feature_importance ?? [];
    return features.slice(0, 15).map((f) => ({
      name: f?.feature_name || 'unknown',
      value: Number(f?.shap_value ?? 0),
      fill: Number(f?.shap_value ?? 0) >= 0 ? '#10b981' : '#ef4444',
      direction: f?.contribution_direction || (Number(f?.shap_value ?? 0) >= 0 ? 'positive' : 'negative'),
      featureValue: f?.feature_value,
      rank: f?.importance_rank
    }));
  }, [explainData]);

  const businessInterpretation = (feature) => {
    const direction = feature?.contribution_direction || (Number(feature?.shap_value ?? 0) >= 0 ? 'positive' : 'negative');
    const featureName = feature?.feature_name || 'this feature';
    const shapVal = Number(feature?.shap_value ?? 0);
    if (direction === 'positive') {
      return `Higher values of ${featureName} increase the predicted fraud probability (SHAP +${shapVal.toFixed(4)}). This is consistent with a higher-risk profile.`;
    }
    return `Higher values of ${featureName} decrease the predicted fraud probability (SHAP ${shapVal.toFixed(4)}). This is consistent with a lower-risk profile.`;
  };

  /* ------------- AI Report ------------- */
  const markdownReport = explainData?.report_generation?.markdown_report;

  /* ------------- Download Report ------------- */
  const buildMarkdown = () => {
    if (!investigateData) return '';

    let md = '# Healthcare Fraud Investigation Report\n\n';
    md += `**Generated on:** ${new Date().toLocaleString()}\n\n`;

    md += '## 1. Provider Details\n\n';
    md += `- **Provider ID:** ${investigateData?.Provider || providerId.toUpperCase()}\n`;
    md += `- **Investigation Status:** Completed\n`;
    md += `- **Fraud Probability:** ${fraudProbability !== undefined && fraudProbability !== null ? (fraudProbability * 100).toFixed(2) + '%' : 'N/A'}\n`;
    md += `- **Fraud Score:** ${fraudScorePercent !== null ? fraudScorePercent.toFixed(2) + '%' : 'N/A'}\n`;
    md += `- **Risk Level:** ${riskTier || 'N/A'}\n`;
    md += `- **Model Confidence:** ${typeof confidence === 'number' ? (confidence * 100).toFixed(1) + '%' : (confidence || 'N/A')}\n`;
    md += `- **Priority:** ${priority || 'N/A'}\n\n`;

    md += '## 2. Fraud Prediction\n\n';
    md += `- **Verdict:** ${isFraud ? '🚨 FRAUD DETECTED' : '✅ NOT FRAUD'}\n\n`;

    if (investigateData?.investigation_summary) {
      md += '## 3. Multi-Agent Investigation Findings\n\n';
      ['provider', 'claim', 'beneficiary', 'coordinator'].forEach((agentKey) => {
        const agentData = investigateData.investigation_summary[agentKey];
        if (!agentData) return;
        md += `### ${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)} Agent\n`;
        if (agentData.risk_score !== undefined) {
          md += `- **Risk Score:** ${(agentData.risk_score * 100).toFixed(1)}%\n`;
        }
        if (agentData.evidence && agentData.evidence.length > 0) {
          md += `- **Evidence:** ${agentData.evidence.map((e) => `${e.metric}: ${e.value} (${e.signal})`).join('; ')}\n`;
        }
        if (agentKey === 'coordinator' && recommendations.length > 0) {
          md += `- **Recommendations:**\n`;
          recommendations.forEach((r) => { md += `  - ${r}\n`; });
        }
        md += '\n';
      });
    }

    md += '## 4. Evidence Table\n\n';
    if (mergedEvidence.length > 0) {
      md += '| Agent | Metric | Value | Signal | Percentile | Z Score |\n';
      md += '|-------|--------|-------|--------|------------|---------|\n';
      mergedEvidence.forEach((item) => {
        md += `| ${item.agent || ''} | ${item.metric || ''} | ${item.value ?? ''} | ${item.signal || ''} | ${item.percentile !== undefined && item.percentile !== null ? (item.percentile * 100).toFixed(0) + '%' : ''} | ${item.zscore !== undefined && item.zscore !== null ? item.zscore.toFixed(2) : ''} |\n`;
      });
    } else {
      md += 'No evidence flags were generated.\n';
    }
    md += '\n';

    if (explainData) {
      md += '## 5. SHAP Explainability\n\n';
      if (shapSummary) {
        md += '### Summary\n\n';
        md += `${shapSummary}\n\n`;
      }
      if (shapFeatures.length > 0) {
        md += '### Top Features\n\n';
        md += '| Rank | Feature | SHAP Value | Direction | Feature Value |\n';
        md += '|------|---------|------------|-----------|---------------|\n';
        shapFeatures.slice(0, 15).forEach((f) => {
          const dir = f?.contribution_direction || (Number(f?.shap_value ?? 0) >= 0 ? 'positive' : 'negative');
          md += `| ${f?.importance_rank ?? ''} | ${f?.feature_name ?? ''} | ${f?.shap_value !== undefined ? Number(f.shap_value).toFixed(4) : ''} | ${dir} | ${f?.feature_value ?? ''} |\n`;
        });
      }
      md += '\n';
    }

    if (markdownReport) {
      md += '## 6. AI-Generated Report\n\n';
      md += `${markdownReport}\n\n`;
    }

    return md;
  };

  const downloadReport = async () => {
    if (!investigateData) return;
    const md = buildMarkdown();
    const filename = `Provider_Report_${investigateData?.Provider || providerId.toUpperCase()}`;

    const downloadMarkdown = () => {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Healthcare Fraud Investigation Report', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

      doc.setFontSize(12);
      doc.text('1. Provider Details', 14, 32);
      doc.setFontSize(10);
      doc.text(`Provider ID: ${investigateData?.Provider || providerId.toUpperCase()}`, 14, 38);
      doc.text(`Fraud Probability: ${fraudProbability !== undefined && fraudProbability !== null ? (fraudProbability * 100).toFixed(2) + '%' : 'N/A'}`, 14, 44);
      doc.text(`Fraud Score: ${fraudScorePercent !== null ? fraudScorePercent.toFixed(2) + '%' : 'N/A'}`, 14, 50);
      doc.text(`Risk Level: ${riskTier || 'N/A'}`, 14, 56);
      doc.text(`Priority: ${priority || 'N/A'}`, 14, 62);

      doc.setFontSize(12);
      doc.text('2. Fraud Prediction', 14, 72);
      doc.setFontSize(10);
      doc.text(`Verdict: ${isFraud ? 'FRAUD DETECTED' : 'NOT FRAUD'}`, 14, 78);

      let y = 88;
      if (mergedEvidence.length > 0) {
        doc.setFontSize(12);
        doc.text('3. Evidence Table', 14, y);
        y += 4;
        autoTable(doc, {
          startY: y,
          head: [['Agent', 'Metric', 'Value', 'Signal', 'Pct', 'Z Score']],
          body: mergedEvidence.map((e) => [
            e.agent || '',
            e.metric || '',
            typeof e.value === 'number' ? (e.value % 1 === 0 ? e.value : e.value.toFixed(2)) : (e.value ?? ''),
            e.signal || '',
            e.percentile !== undefined && e.percentile !== null ? (e.percentile * 100).toFixed(0) + '%' : '',
            e.zscore !== undefined && e.zscore !== null ? e.zscore.toFixed(2) : ''
          ]),
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229] },
          margin: { left: 14, right: 14 }
        });
      }

      if (shapFeatures.length > 0) {
        doc.setFontSize(12);
        y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : y;
        doc.text('4. SHAP Top Features', 14, y);
        y += 4;
        autoTable(doc, {
          startY: y,
          head: [['Rank', 'Feature', 'SHAP Value', 'Direction', 'Value']],
          body: shapFeatures.slice(0, 15).map((f) => [
            f?.importance_rank ?? '',
            f?.feature_name ?? '',
            f?.shap_value !== undefined ? Number(f.shap_value).toFixed(4) : '',
            f?.contribution_direction || (Number(f?.shap_value ?? 0) >= 0 ? 'positive' : 'negative'),
            f?.feature_value ?? ''
          ]),
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229] },
          margin: { left: 14, right: 14 }
        });
      }

      if (markdownReport) {
        doc.setFontSize(12);
        y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : y + 12;
        doc.text('5. AI-Generated Report (Preview)', 14, y);
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(markdownReport, 180);
        const preview = lines.slice(0, 60);
        doc.text(preview, 14, y + 6);
      }

      doc.save(`${filename}.pdf`);
    } catch (err) {
      console.warn('PDF generation failed, falling back to Markdown download.', err);
      downloadMarkdown();
    }
  };

  /* ------------- Agent finding enrichment (severity/confidence from reusable findings) ------------- */
  const getAgentFinding = (agentKey) => {
    const findings = investigateData?.reusable_agent_findings || [];
    return findings.find((f) => f?.agent_name === agentKey);
  };

  const providerFinding = getAgentFinding('provider');
  const claimFinding = getAgentFinding('claim');
  const beneficiaryFinding = getAgentFinding('beneficiary');

  /* ------------- Loading animation ------------- */
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in-up pb-10">
        <div className="bg-white rounded-3xl p-8 shadow-md border border-slate-100 relative overflow-hidden">
          <div className="absolute top-[-80px] right-[-80px] w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-10 pointer-events-none"></div>
          <div className="flex flex-col items-center justify-center py-20 relative z-10">
            {/* Professional multi-ring loader */}
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
              <div className="absolute inset-3 rounded-full border-4 border-teal-100"></div>
              <div className="absolute inset-3 rounded-full border-4 border-teal-500 border-b-transparent animate-spin animation-delay-2000" style={{ animationDirection: 'reverse' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-indigo-600 animate-pulse" />
              </div>
            </div>
            <p className="text-slate-500 font-bold mt-6 animate-pulse text-lg">Running Multi-Agent Investigation...</p>
            <p className="text-slate-400 text-sm font-semibold mt-1">Analyzing provider, claim & beneficiary signals concurrently with SHAP explainability</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up pb-10">
      {/* Search Console */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-md border border-slate-100 relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-teal-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-10 pointer-events-none"></div>

        <div className="flex items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mr-5 shadow-lg shadow-indigo-500/20 shrink-0">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">Provider Investigation</h2>
            <p className="text-slate-500 font-medium text-sm mt-0.5">Real-time clinical provider risk scoring, evidence fusion, SHAP explainability, and automated AI reports.</p>
          </div>
        </div>

        <form onSubmit={handleInvestigate} className="flex flex-col sm:flex-row gap-4 relative z-10">
          <div className="flex-1 relative group">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              required
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder="Enter Provider ID to investigate (e.g., PRV51008)"
              className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 lg:px-8 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center">
                <Activity className="w-5 h-5 mr-2 animate-spin" />
                Investigating...
              </div>
            ) : (
              'Run AI Investigation'
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 animate-pulse shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {investigateData && (
        <div className="space-y-8 animate-fade-in-up">
          {/* Section 1 — Provider Investigation Header */}
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block">Provider ID</span>
                <span className="text-xl font-black text-slate-800 mt-0.5 block">{investigateData?.Provider ?? providerId.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block">Current Time</span>
                <span className="text-sm font-bold text-slate-600 mt-0.5 block">{new Date().toLocaleString()}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block">Investigation Status</span>
                <span className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl font-bold shadow-sm text-xs mt-1">
                  <CheckCircle className="w-4 h-4" />
                  Investigation Completed
                </span>
              </div>
            </div>
          </div>

          {/* Section 2 — Fraud Prediction Summary */}
          <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-5 pointer-events-none"></div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 relative z-10 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Fraud Prediction Summary
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center relative z-10">
              {/* Circular score */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                {fraudScorePercent !== null ? (
                  <CircularProgress value={fraudScorePercent} />
                ) : (
                  <span className="text-xl font-bold text-slate-500">Not Available</span>
                )}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Model Fraud Score</span>
              </div>

              {/* Summary variables */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fraud Probability</span>
                  <span className="text-xl font-black text-slate-800 block mt-1">
                    {fraudProbability !== undefined && fraudProbability !== null ? `${(fraudProbability * 100).toFixed(2)}%` : 'Not Available'}
                  </span>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Risk Level</span>
                  <span className={`text-xl font-black block mt-1 capitalize ${
                    riskTier === 'high' ? 'text-rose-600' : riskTier === 'medium' ? 'text-amber-600' : riskTier === 'low' ? 'text-emerald-600' : 'text-slate-600'
                  }`}>{riskTier ?? 'Not Available'}</span>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Model Confidence</span>
                  <span className="text-xl font-black text-slate-800 block mt-1">
                    {typeof confidence === 'number' ? `${(confidence * 100).toFixed(1)}%` : (confidence ?? 'Not Available')}
                  </span>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Priority</span>
                  <span className={`text-xl font-black block mt-1 ${
                    priority === 'High' ? 'text-rose-600' : priority === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{priority ?? 'Not Available'}</span>
                </div>

                <div className="sm:col-span-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Prediction Verdict</span>
                    <span className="text-xs text-slate-400 font-semibold block mt-0.5">Based on backend ML model prediction</span>
                  </div>
                  {isFraud !== null && (
                    <span className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black shadow-sm border ${
                      isFraud
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      {isFraud ? '🚨 FRAUD DETECTED' : '✅ NOT FRAUD'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 — Multi-Agent Investigation */}
          {(investigateData?.investigation_summary?.provider ||
            investigateData?.investigation_summary?.claim ||
            investigateData?.investigation_summary?.beneficiary ||
            investigateData?.investigation_summary?.coordinator) && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" /> Multi-Agent Investigation
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {investigateData?.investigation_summary?.provider && (
                  <AgentMetaCard
                    title="Provider Agent"
                    icon={<Building2 className="w-6 h-6" />}
                    summary={providerFinding?.reasoning || 'Evaluated billing structures, growth trends, and peer specialty comparison indicators.'}
                    riskScore={investigateData.investigation_summary.provider.risk_score}
                    severity={providerFinding?.severity}
                    confidence={providerFinding?.confidence}
                    recommendation={providerFinding?.recommended_investigation}
                    evidence={investigateData.investigation_summary.provider.evidence}
                  />
                )}

                {investigateData?.investigation_summary?.claim && (
                  <AgentMetaCard
                    title="Claim Agent"
                    icon={<Stethoscope className="w-6 h-6" />}
                    summary={claimFinding?.reasoning || 'Analyzed average claim duration patterns, duplication rates, procedure values, and inpatient ratios.'}
                    riskScore={investigateData.investigation_summary.claim.risk_score}
                    severity={claimFinding?.severity}
                    confidence={claimFinding?.confidence}
                    recommendation={claimFinding?.recommended_investigation}
                    evidence={investigateData.investigation_summary.claim.evidence}
                  />
                )}

                {investigateData?.investigation_summary?.beneficiary && (
                  <AgentMetaCard
                    title="Beneficiary Agent"
                    icon={<HeartPulse className="w-6 h-6" />}
                    summary={beneficiaryFinding?.reasoning || 'Checked chronic illness distributions, patient age statistics, deceased patient rate records, and cohort concentration details.'}
                    riskScore={investigateData.investigation_summary.beneficiary.risk_score}
                    severity={beneficiaryFinding?.severity}
                    confidence={beneficiaryFinding?.confidence}
                    recommendation={beneficiaryFinding?.recommended_investigation}
                    evidence={investigateData.investigation_summary.beneficiary.evidence}
                  />
                )}

                {investigateData?.investigation_summary?.coordinator && (
                  <CoordinatorCard
                    coordinator={investigateData.investigation_summary.coordinator}
                    recommendations={recommendations}
                  />
                )}
              </div>
            </div>
          )}

          {/* Section 4 — Evidence Table */}
          {mergedEvidence.length > 0 && (
            <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Evidence Table</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Consolidated evidence flags from all analytical agents. Search, sort and paginate.</p>
                </div>

                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    placeholder="Search metrics or agents..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold">
                      {['agent', 'metric', 'value', 'signal', 'percentile', 'zscore'].map((colKey) => (
                        <th key={colKey} className="py-3 px-4 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none" onClick={() => handleSort(colKey)}>
                          <span className="flex items-center">
                            {colKey === 'agent' ? 'Agent' : colKey === 'metric' ? 'Metric' : colKey === 'value' ? 'Value' : colKey === 'signal' ? 'Signal' : colKey === 'percentile' ? 'Percentile' : 'Z Score'}
                            {getSortIcon(colKey)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold text-xs">
                    {paginatedEvidence.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          item?.signal === 'elevated'
                            ? 'bg-rose-50/50 hover:bg-rose-50/80'
                            : item?.signal === 'outlier_low'
                              ? 'bg-amber-50/40 hover:bg-amber-50/70'
                              : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-indigo-600">{item.agent}</td>
                        <td className="py-3 px-4 text-slate-800 font-bold">{item.metric}</td>
                        <td className="py-3 px-4">
                          {typeof item.value === 'number' ? (item.value % 1 === 0 ? item.value : item.value.toFixed(2)) : String(item.value ?? '—')}
                        </td>
                        <td className="py-3 px-4">
                          {item.signal && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.signal === 'elevated'
                                ? 'bg-rose-100 border-rose-200 text-rose-700'
                                : item.signal === 'outlier_low'
                                  ? 'bg-amber-100 border-amber-200 text-amber-700'
                                  : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}>
                              {item.signal}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.percentile !== undefined && item.percentile !== null ? `${(item.percentile * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {item.zscore !== undefined && item.zscore !== null ? item.zscore.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                    {paginatedEvidence.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400 italic">No matching evidence found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredAndSorted.length > pageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400 font-bold">
                    Showing {filteredAndSorted.length === 0 ? 0 : ((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, filteredAndSorted.length)} of {filteredAndSorted.length} evidence items
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      disabled={safePage <= 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-40 transition-colors"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-bold text-slate-600 px-2">
                      Page {safePage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage >= totalPages}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 5 — SHAP Explainability */}
          {explainData && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-500" /> SHAP Explainability
              </h3>

              {shapSummary && (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-500" /> SHAP Summary
                  </h4>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{shapSummary}</p>
                </div>
              )}

              {shapFeatures.length > 0 && (
                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-md">
                  <h4 className="text-sm font-bold text-slate-800 mb-6">Top Features</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Feature importance bar chart */}
                    <div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value, name, props) => {
                                if (name === 'value') {
                                  return [
                                    <span key="val" className={props.payload?.value >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                                      {Number(value).toFixed(4)}
                                    </span>,
                                    'SHAP Value'
                                  ];
                                }
                                return [value, name];
                              }}
                              labelFormatter={(label, payload) => {
                                const item = payload?.[0]?.payload;
                                if (!item) return label;
                                return `${item.name} (${item.direction}) — Feature Value: ${item.featureValue ?? 'N/A'}`;
                              }}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-4 justify-center mt-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                          <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span> Positive (increases fraud risk)
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                          <span className="w-3 h-3 rounded bg-red-500 inline-block"></span> Negative (decreases fraud risk)
                        </span>
                      </div>
                    </div>

                    {/* Feature cards */}
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                      {shapFeatures.slice(0, 10).map((feature, idx) => {
                        const direction = feature?.contribution_direction || (Number(feature?.shap_value ?? 0) >= 0 ? 'positive' : 'negative');
                        const isPositive = direction === 'positive';
                        return (
                          <div key={idx} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-black text-white bg-indigo-500 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                  {feature?.importance_rank ?? idx + 1}
                                </span>
                                <span className="text-sm font-bold text-slate-800 truncate">{feature?.feature_name}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                isPositive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-red-50 text-red-700 border-red-100'
                              }`}>
                                {direction}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">SHAP Value</span>
                                <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {Number(feature?.shap_value ?? 0).toFixed(4)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Feature Value</span>
                                <span className="font-black text-slate-700">{feature?.feature_value ?? '—'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Rank</span>
                                <span className="font-black text-slate-700">#{feature?.importance_rank ?? idx + 1}</span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                              {businessInterpretation(feature)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SHAP Plots */}
              {(summaryPlot || waterfallPlot) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {summaryPlot && (
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
                      <h4 className="text-sm font-bold text-slate-800 mb-4">SHAP Summary Plot</h4>
                      <img
                        src={`data:image/png;base64,${summaryPlot}`}
                        alt="SHAP Summary Plot"
                        className="w-full h-auto rounded-xl border border-slate-100"
                      />
                    </div>
                  )}
                  {waterfallPlot && (
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
                      <h4 className="text-sm font-bold text-slate-800 mb-4">SHAP Waterfall Plot</h4>
                      <img
                        src={`data:image/png;base64,${waterfallPlot}`}
                        alt="SHAP Waterfall Plot"
                        className="w-full h-auto rounded-xl border border-slate-100"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Explainability unavailable notice */}
          {!explainData && explainError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-4 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="font-semibold">{explainError}</span>
            </div>
          )}

          {/* Section 6 — AI Investigation Report */}
          {markdownReport && (
            <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-md">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" /> AI Investigation Report
              </h3>
              <div className="markdown-report">
                <ReactMarkdown>{markdownReport}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Section 7 — Recommended Actions */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Recommended Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[50px] opacity-5 pointer-events-none"></div>
                    <div className="flex items-start gap-4 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-black text-slate-800">Action {index + 1}</h4>
                          {priority === 'High' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wider">
                              High Priority
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">{rec}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 8 — Download Report */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={downloadReport}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              Download Report (PDF)
            </button>
          </div>

          {/* Developer View */}
          <DeveloperView data={investigateData} label="Investigation Response" />
        </div>
      )}

      {/* Explainability-only fallback info when investigation succeeds but explain request returns data */}
      {!investigateData && explainData && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-2xl flex items-center gap-2">
          <XCircle className="w-5 h-5 shrink-0" />
          <span className="font-semibold">Unable to retrieve investigation. Please verify the Provider ID.</span>
        </div>
      )}
    </div>
  );
};

export default ProviderInvestigation;