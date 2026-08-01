import React, { useState } from 'react';
import axios from 'axios';
import {
  Search,
  ShieldAlert,
  CheckCircle,
  Activity,
  AlertTriangle,
  FileText,
  Briefcase,
  Users,
  Sparkles,
  Download,
  ChevronUp,
  ChevronDown,
  Info
} from 'lucide-react';

// Circular progress indicator component for Fraud Score
const CircularProgress = ({ value }) => {
  const percentage = Math.min(100, Math.max(0, value || 0));
  const radius = 60;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let strokeColor = "stroke-emerald-500";
  if (percentage >= 80) strokeColor = "stroke-rose-500";
  else if (percentage >= 50) strokeColor = "stroke-amber-500";

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
          className={`${strokeColor} transition-all duration-300 ease-out`}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-slate-800">{percentage.toFixed(1)}%</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
};

// Collapsible accordion for raw response JSON
const Accordion = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors font-bold text-slate-700 focus:outline-none"
      >
        <span className="text-sm uppercase tracking-wider">{title}</span>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="p-6 border-t border-slate-200 bg-slate-900 overflow-x-auto max-h-[500px]">
          {children}
        </div>
      )}
    </div>
  );
};

// Single Agent Card
const AgentCard = ({ agentKey, title, summary, riskScore, evidence, reusableFindings }) => {
  const agentFinding = reusableFindings?.find(f => f?.agent_name === agentKey);
  const severity = agentFinding?.severity;
  const confidence = agentFinding?.confidence;
  const reasoning = agentFinding?.reasoning ?? summary;
  const recommendation = agentFinding?.recommended_investigation;

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md flex flex-col justify-between hover:shadow-lg transition-shadow">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-bold text-slate-800">{title}</h4>
          {riskScore !== undefined && riskScore !== null && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              riskScore >= 0.8 ? 'bg-rose-100 text-rose-700' : riskScore >= 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              Risk Score: {riskScore}
            </span>
          )}
        </div>

        {reasoning && (
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Analysis Summary</p>
            <p className="text-sm text-slate-600 font-medium leading-relaxed mt-1">{reasoning}</p>
          </div>
        )}

        {(severity || confidence) && (
          <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            {severity && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Severity</span>
                <span className={`text-xs font-extrabold block capitalize ${
                  severity === 'high' ? 'text-rose-600' : severity === 'medium' ? 'text-amber-600' : 'text-slate-600'
                }`}>{severity}</span>
              </div>
            )}
            {confidence !== undefined && confidence !== null && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Confidence</span>
                <span className="text-xs font-extrabold text-slate-800 block">{(confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        )}

        {evidence && evidence.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Evidence Flags</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 text-slate-400 font-bold bg-slate-50/50">
                    <th className="py-1 px-2">Metric</th>
                    <th className="py-1 px-2">Value</th>
                    <th className="py-1 px-2">Signal</th>
                    <th className="py-1 px-2">Pct</th>
                    <th className="py-1 px-2">Z-Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  {evidence.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 font-semibold text-slate-800">{item?.metric ?? '—'}</td>
                      <td className="py-1.5 px-2">{typeof item?.value === 'number' ? (item.value % 1 === 0 ? item.value : item.value.toFixed(2)) : String(item?.value ?? '—')}</td>
                      <td className="py-1.5 px-2">
                        {item?.signal && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.signal === 'elevated' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-150 text-slate-600'
                          }`}>
                            {item.signal}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">{item?.percentile !== undefined && item?.percentile !== null ? `${(item.percentile * 100).toFixed(0)}%` : '—'}</td>
                      <td className="py-1.5 px-2">{item?.zscore !== undefined && item?.zscore !== null ? item.zscore.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {recommendation && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Action Plan</p>
          <p className="text-xs text-slate-500 font-semibold mt-1">{recommendation}</p>
        </div>
      )}
    </div>
  );
};

// Coordinator Summary Card
const CoordinatorCard = ({ coordinator, recommendations }) => {
  const riskScore = coordinator?.['Fraud Score'] ?? coordinator?.risk_score;
  const riskTier = coordinator?.risk_tier;
  const confidence = coordinator?.Confidence ?? coordinator?.confidence;
  const priority = coordinator?.Priority ?? coordinator?.priority;

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-950 rounded-3xl p-6 text-white flex flex-col justify-between hover:shadow-lg transition-shadow relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500 rounded-full mix-blend-screen filter blur-[80px] opacity-10 pointer-events-none"></div>
      
      <div>
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
          <h4 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" /> Coordinator Agent
          </h4>
          {riskScore !== undefined && riskScore !== null && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              riskScore >= 0.8 ? 'bg-rose-500/20 text-rose-300' : riskScore >= 0.5 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              Overall Score: {riskScore}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {riskTier && (
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk Tier</span>
              <span className="text-sm font-extrabold text-indigo-300 capitalize mt-1 block">{riskTier}</span>
            </div>
          )}
          {confidence !== undefined && confidence !== null && (
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confidence</span>
              <span className="text-sm font-extrabold text-indigo-300 mt-1 block">
                {typeof confidence === 'number' ? `${(confidence * 100).toFixed(0)}%` : confidence}
              </span>
            </div>
          )}
          {priority && (
            <div className="col-span-2 bg-white/5 p-3 rounded-xl border border-white/5 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Priority Level</span>
              <span className={`text-sm font-extrabold mt-1 block ${
                priority === 'High' ? 'text-rose-400' : priority === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
              }`}>{priority}</span>
            </div>
          )}
        </div>

        {recommendations && recommendations.length > 0 && (
          <div>
            <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Priority Recommendations</p>
            <ul className="space-y-2">
              {recommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-xs bg-white/5 border border-white/5 p-2 rounded-lg text-slate-300 flex items-start gap-2">
                  <span className="text-indigo-400 font-bold">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const ProviderSearch = () => {
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [investigateData, setInvestigateData] = useState(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Call ONLY POST /investigate
  const handleInvestigate = async (e) => {
    e.preventDefault();
    if (!providerId.trim()) return;

    setLoading(true);
    setError('');
    setInvestigateData(null);

    const formattedId = providerId.trim();

    try {
      const investigateRes = await axios.post(`http://127.0.0.1:8000/investigate`, { 
        provider_id: formattedId 
      });
      setInvestigateData(investigateRes?.data);
    } catch (err) {
      console.error("Investigation Error:", err);
      if (err.response) {
        if (err.response.status === 404) {
          setError("Provider not found");
        } else if (err.response.status === 500) {
          setError("Investigation failed. Please try again.");
        } else {
          setError(err.response?.data?.detail || "Investigation failed.");
        }
      } else if (err.request) {
        setError("Unable to connect to backend.");
      } else {
        setError("Unable to connect to backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Derive parameters defensively
  const rawFraudScore = investigateData?.investigation_summary?.coordinator?.['Fraud Score'] 
    ?? investigateData?.investigation_summary?.coordinator?.risk_score 
    ?? investigateData?.fraud_probability;

  let fraudScorePercent = null;
  if (rawFraudScore !== undefined && rawFraudScore !== null) {
    fraudScorePercent = rawFraudScore <= 1.0 ? rawFraudScore * 100 : rawFraudScore;
  }

  let fraudProbability = investigateData?.fraud_probability;
  if (fraudProbability === undefined || fraudProbability === null) {
    if (fraudScorePercent !== null) {
      fraudProbability = fraudScorePercent / 100;
    }
  }

  const scoreToUse = fraudScorePercent !== null ? fraudScorePercent : null;

  const riskTier = investigateData?.investigation_summary?.coordinator?.risk_tier
    ?? (scoreToUse !== null ? (scoreToUse >= 80 ? 'high' : scoreToUse >= 50 ? 'medium' : 'low') : null);

  const confidence = investigateData?.investigation_summary?.coordinator?.Confidence
    ?? investigateData?.investigation_summary?.coordinator?.confidence;

  const priority = investigateData?.investigation_summary?.coordinator?.Priority
    ?? investigateData?.investigation_summary?.coordinator?.priority;

  // Badge logic
  const renderFraudBadge = (score) => {
    if (score === null || score === undefined) return null;
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-2 rounded-2xl text-xs font-black shadow-sm animate-pulse">
          🚨 HIGH FRAUD RISK
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2 rounded-2xl text-xs font-black shadow-sm">
          ⚠ MEDIUM RISK
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl text-xs font-black shadow-sm">
        ✅ LOW RISK
      </span>
    );
  };

  // Merge evidence dynamically
  const providerEvidence = investigateData?.investigation_summary?.provider?.evidence || [];
  const claimEvidence = investigateData?.investigation_summary?.claim?.evidence || [];
  const beneficiaryEvidence = investigateData?.investigation_summary?.beneficiary?.evidence || [];

  const mergedEvidence = [
    ...providerEvidence.map(item => ({ ...item, agent: "Provider" })),
    ...claimEvidence.map(item => ({ ...item, agent: "Claim" })),
    ...beneficiaryEvidence.map(item => ({ ...item, agent: "Beneficiary" }))
  ];

  // Dynamically determine existing columns based on response fields
  const allColumns = [
    { key: 'agent', label: 'Agent' },
    { key: 'metric', label: 'Metric' },
    { key: 'value', label: 'Value' },
    { key: 'signal', label: 'Signal' },
    { key: 'percentile', label: 'Percentile' },
    { key: 'zscore', label: 'Z Score' }
  ];

  const existingColumns = allColumns.filter(col => {
    return mergedEvidence.some(item => item[col.key] !== undefined && item[col.key] !== null);
  });

  const filteredEvidence = mergedEvidence.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      (item?.agent?.toLowerCase().includes(q)) ||
      (item?.metric?.toLowerCase().includes(q)) ||
      (item?.signal?.toLowerCase().includes(q))
    );
  });

  // Action Plan/Recommendations
  const recommendations = investigateData?.investigation_summary?.coordinator?.Recommendation 
    ?? investigateData?.investigation_summary?.coordinator?.recommended_actions 
    ?? [];

  // Completed Tasks Workflow
  const tasks = investigateData?.tasks || [];
  const taskList = [
    { key: "provider_analysis", label: "Provider Analysis" },
    { key: "claim_analysis", label: "Claim Analysis" },
    { key: "beneficiary_analysis", label: "Beneficiary Analysis" },
    { key: "coordinator", label: "Coordinator Review" }
  ];

  // Helper to download report
  const downloadReport = () => {
    if (!investigateData) return;

    let md = `# Healthcare Fraud Investigation Report\n`;
    md += `Generated on: ${new Date().toLocaleString()}\n\n`;
    md += `## Prediction Summary\n`;
    md += `- **Provider ID**: ${investigateData?.Provider || providerId}\n`;
    md += `- **Fraud Score**: ${scoreToUse !== null ? scoreToUse.toFixed(2) + '%' : 'N/A'}\n`;
    md += `- **Risk Level**: ${riskTier || 'N/A'}\n`;
    md += `- **Confidence**: ${typeof confidence === 'number' ? (confidence * 100).toFixed(0) + '%' : 'N/A'}\n`;
    md += `- **Priority**: ${priority || 'N/A'}\n\n`;

    if (investigateData?.investigation_summary) {
      md += `## Multi-Agent Investigation Findings\n`;
      ['provider', 'claim', 'beneficiary'].forEach(agent => {
        const summary = investigateData.investigation_summary[agent];
        if (summary) {
          md += `### ${agent.toUpperCase()} Analysis\n`;
          md += `- **Risk Score**: ${summary.risk_score || 'N/A'}\n`;
          if (summary.evidence) {
            md += `- **Evidence Flags**: ${summary.evidence.map(e => `${e.metric}: ${e.value} (${e.signal})`).join(', ')}\n`;
          }
          md += `\n`;
        }
      });
    }

    if (recommendations && recommendations.length > 0) {
      md += `## Coordinator Recommendations\n`;
      recommendations.forEach(rec => {
        md += `- ${rec}\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Provider_Report_${investigateData?.Provider || providerId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up pb-10">
      
      {/* Search Console */}
      <div className="bg-white rounded-3xl p-8 shadow-md border border-slate-100 relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-teal-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-10 pointer-events-none"></div>

        <div className="flex items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mr-5 shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Provider Investigation Console</h2>
            <p className="text-slate-500 font-medium">Real-time clinical provider risk scoring, evidence fusion, and automated multi-agent reports.</p>
          </div>
        </div>

        <form onSubmit={handleInvestigate} className="flex gap-4 relative z-10">
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
            className="px-8 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5"
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
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <span className="font-semibold">{error}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-md">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold mt-4 animate-pulse">🤖 Synthesizing Multi-Agent Context...</p>
        </div>
      )}

      {/* Investigation Details Panel */}
      {investigateData && !loading && (
        <div className="space-y-8 animate-fade-in-up">

          {/* Section 1 — Header */}
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
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block font-sans">Status</span>
                <span className="text-sm font-black text-slate-700 mt-0.5 block flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Completed
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block">Current Time</span>
                <span className="text-sm font-bold text-slate-600 mt-0.5 block">{new Date().toLocaleString()}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl font-bold flex items-center shadow-sm text-xs">
                <CheckCircle className="w-4 h-4 mr-2" />
                Investigated Successfully
              </div>
            </div>
          </div>

          {/* Section 2 — Fraud Summary */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Investigation Summary</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              
              {/* Circular/Linear progress element */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                {scoreToUse !== null ? (
                  <CircularProgress value={scoreToUse} />
                ) : (
                  <span className="text-xl font-bold text-slate-500">Not Available</span>
                )}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Calculated Risk Index</span>
              </div>

              {/* Summary variables */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fraud Probability</span>
                  <span className="text-xl font-black text-slate-800 block mt-1">
                    {fraudProbability !== undefined && fraudProbability !== null ? fraudProbability.toFixed(4) : "Not Available"}
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
                    {typeof confidence === 'number' ? `${(confidence * 100).toFixed(0)}%` : (confidence ?? 'Not Available')}
                  </span>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Priority</span>
                  <span className={`text-xl font-black block mt-1 ${
                    priority === 'High' ? 'text-rose-600' : priority === 'Medium' ? 'text-amber-600' : 'text-emerald-600 font-sans'
                  }`}>{priority ?? 'Not Available'}</span>
                </div>

                {scoreToUse !== null && (
                  <div className="sm:col-span-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block font-sans">Fraud Badge</span>
                      <span className="text-xs text-slate-400 font-semibold block mt-0.5">Assigned cohort fraud classification</span>
                    </div>
                    <div>
                      {renderFraudBadge(scoreToUse)}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Section 3 — Multi-Agent Investigation */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Multi-Agent Investigation</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {investigateData?.investigation_summary?.provider && (
                <AgentCard
                  agentKey="provider"
                  title="Provider Agent"
                  summary="Evaluated billing structures, growth trends, and peer specialty comparison indicators."
                  riskScore={investigateData.investigation_summary.provider.risk_score}
                  evidence={investigateData.investigation_summary.provider.evidence}
                  reusableFindings={investigateData.reusable_agent_findings}
                />
              )}

              {investigateData?.investigation_summary?.claim && (
                <AgentCard
                  agentKey="claim"
                  title="Claim Agent"
                  summary="Analyzed average claim duration patterns, duplication rates, procedure values, and inpatient ratios."
                  riskScore={investigateData.investigation_summary.claim.risk_score}
                  evidence={investigateData.investigation_summary.claim.evidence}
                  reusableFindings={investigateData.reusable_agent_findings}
                />
              )}

              {investigateData?.investigation_summary?.beneficiary && (
                <AgentCard
                  agentKey="beneficiary"
                  title="Beneficiary Agent"
                  summary="Checked chronic illness distributions, patient age statistics, deceased patient rate records, and cohort concentration details."
                  riskScore={investigateData.investigation_summary.beneficiary.risk_score}
                  evidence={investigateData.investigation_summary.beneficiary.evidence}
                  reusableFindings={investigateData.reusable_agent_findings}
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

          {/* Section 4 — Evidence Table */}
          {mergedEvidence.length > 0 && (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Evidence Log</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Consolidated evidence flags from all analytical agents.</p>
                </div>
                
                {/* Search query input */}
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search metrics or agents..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-700"
                  />
                </div>
              </div>

              {/* Render dynamic columns table */}
              {existingColumns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold animate-fade-in">
                        {existingColumns.map(col => (
                          <th key={col.key} className="py-3 px-4 uppercase tracking-wider">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold text-xs">
                      {filteredEvidence.map((item, idx) => (
                        <tr 
                          key={idx} 
                          className={`transition-colors ${
                            item?.signal === 'elevated' 
                              ? 'bg-rose-50/50 hover:bg-rose-50/80 text-rose-950' 
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {existingColumns.map(col => {
                            if (col.key === 'agent') {
                              return <td key={col.key} className="py-3 px-4 font-bold text-indigo-600">{item.agent}</td>;
                            }
                            if (col.key === 'metric') {
                              return <td key={col.key} className="py-3 px-4 text-slate-800 font-bold">{item.metric}</td>;
                            }
                            if (col.key === 'value') {
                              return <td key={col.key} className="py-3 px-4">
                                {typeof item.value === 'number' ? (item.value % 1 === 0 ? item.value : item.value.toFixed(2)) : String(item.value ?? '—')}
                              </td>;
                            }
                            if (col.key === 'signal') {
                              return (
                                <td key={col.key} className="py-3 px-4">
                                  {item.signal && (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      item.signal === 'elevated' 
                                        ? 'bg-rose-100 border-rose-200 text-rose-700' 
                                        : 'bg-slate-100 border-slate-200 text-slate-500'
                                    }`}>
                                      {item.signal}
                                    </span>
                                  )}
                                </td>
                              );
                            }
                            if (col.key === 'percentile') {
                              return <td key={col.key} className="py-3 px-4">
                                {item.percentile !== undefined && item.percentile !== null ? `${(item.percentile * 100).toFixed(0)}%` : '—'}
                              </td>;
                            }
                            if (col.key === 'zscore') {
                              return <td key={col.key} className="py-3 px-4">
                                {item.zscore !== undefined && item.zscore !== null ? item.zscore.toFixed(2) : '—'}
                              </td>;
                            }
                            return <td key={col.key} className="py-3 px-4">—</td>;
                          })}
                        </tr>
                      ))}
                      {filteredEvidence.length === 0 && (
                        <tr>
                          <td colSpan={existingColumns.length} className="text-center py-6 text-slate-400 italic">No matching evidence found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 italic">No evidence columns available.</div>
              )}
            </div>
          )}

          {/* Section 5 — Investigation Workflow */}
          {tasks.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Investigation Workflow Progress</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {taskList.map((task) => {
                  const isCompleted = tasks?.includes(task.key);
                  return (
                    <div key={task.key} className={`p-4 rounded-2xl border flex items-center gap-3 transition-colors ${
                      isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      <CheckCircle className={`w-6 h-6 shrink-0 ${isCompleted ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <div>
                        <p className="text-sm font-bold leading-tight font-sans">{task.label}</p>
                        <p className="text-[9px] font-bold tracking-wider uppercase mt-0.5">{isCompleted ? "Completed" : "Pending"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 6 — Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Recommended Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendations.map((rec, index) => (
                  <div key={index} className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[50px] opacity-5 pointer-events-none"></div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800">Action Recommendation {index + 1}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{rec}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download Report Trigger Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={downloadReport}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              Download Compiled Report (.MD)
            </button>
          </div>

          {/* Section 7 — Raw JSON accordion */}
          <Accordion title="Raw Investigation JSON Data">
            <pre className="text-xs text-emerald-400 font-mono leading-relaxed p-2 select-all">
              {JSON.stringify(investigateData, null, 2)}
            </pre>
          </Accordion>

        </div>
      )}

    </div>
  );
};

export default ProviderSearch;