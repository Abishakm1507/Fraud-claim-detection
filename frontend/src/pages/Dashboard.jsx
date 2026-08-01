import React, { useState } from 'react';
import {
  Users,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  Activity,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Award,
  BookOpen
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { datasetStats } from '../assets/datasetStats';

const Dashboard = () => {
  const [sortField, setSortField] = useState('prob');
  const [sortDirection, setSortDirection] = useState('desc');

  const fraudPercentage = (datasetStats.fraudCount / datasetStats.totalProviders) * 100;

  // Risk colors mapping
  const riskColors = {
    Low: '#10b981',    // Emerald
    Medium: '#f59e0b', // Amber
    High: '#ef4444'    // Red
  };

  // Pie chart data for Fraud vs Non-Fraud
  const fraudPieData = [
    { name: 'Non-Fraud Providers', value: datasetStats.nonFraudCount, color: '#6366f1' },
    { name: 'Fraud Providers', value: datasetStats.fraudCount, color: '#ef4444' }
  ];

  // Bar chart data for Risk Level Distribution
  const riskBarData = Object.keys(datasetStats.riskLevels).map(level => ({
    name: level,
    count: datasetStats.riskLevels[level],
    color: riskColors[level]
  }));

  // Inpatient vs Outpatient Pie Data
  const claimRatioData = [
    { name: 'Inpatient Claims', value: datasetStats.inpatientClaims, color: '#3b82f6' },
    { name: 'Outpatient Claims', value: datasetStats.outpatientClaims, color: '#10b981' }
  ];

  // Fraud Score Distribution — derived from real risk-level counts using classifier thresholds
  const fraudScoreBins = [
    { name: '0-50', label: 'Low Risk', count: datasetStats.riskLevels.Low, color: '#10b981', pct: Math.round((datasetStats.riskLevels.Low / datasetStats.totalProviders) * 100) },
    { name: '50-80', label: 'Medium Risk', count: datasetStats.riskLevels.Medium, color: '#f59e0b', pct: Math.round((datasetStats.riskLevels.Medium / datasetStats.totalProviders) * 100) },
    { name: '80-100', label: 'High Risk', count: datasetStats.riskLevels.High, color: '#ef4444', pct: Math.round((datasetStats.riskLevels.High / datasetStats.totalProviders) * 100) }
  ];

  // Reimbursement comparison
  const reimbursementData = [
    { name: 'Non-Fraud Avg', amount: Math.round(datasetStats.reimbursement.nonFraud), color: '#6366f1' },
    { name: 'Fraud Avg', amount: Math.round(datasetStats.reimbursement.fraud), color: '#ef4444' }
  ];

  // Top providers sorting logic
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedProviders = [...datasetStats.topProviders].sort((a, b) => {
    let valueA = a[sortField];
    let valueB = b[sortField];

    if (sortField === 'prob') {
      valueA = a.prob;
      valueB = b.prob;
    }

    if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  return (
    <div className="space-y-8 animate-fade-in-up pb-10">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Healthcare Fraud Analytics Dashboard</h2>
          <p className="text-slate-500 font-medium mt-1">High-level statistical overview of provider dataset and predictive ML model performance.</p>
        </div>

      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex items-center transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600 mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Providers</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{datasetStats.totalProviders.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex items-center transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="bg-rose-50 p-4 rounded-xl text-rose-600 mr-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fraud Providers</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{datasetStats.fraudCount.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex items-center transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600 mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Non-Fraud</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{datasetStats.nonFraudCount.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex items-center transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="bg-amber-50 p-4 rounded-xl text-amber-600 mr-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fraud Rate</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{fraudPercentage.toFixed(2)}%</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex items-center transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="bg-indigo-50 p-4 rounded-xl text-indigo-500 mr-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Fraud Score</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{datasetStats.avgFraudScore.toFixed(2)}%</h3>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Fraud vs Non-Fraud Distribution */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Users className="w-5 h-5 text-indigo-500 mr-2" /> Fraud vs Non-Fraud Distribution
          </h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fraudPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {fraudPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} Providers`, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Level Distribution */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <ShieldAlert className="w-5 h-5 text-indigo-500 mr-2" /> Predicted Risk Level Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBarData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} Providers`, 'Count']} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {riskBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Claim Reimbursement Comparison */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 text-indigo-500 mr-2" /> Average Claim Reimbursements
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reimbursementData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Avg Reimbursement']} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {reimbursementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fraud Score Distribution */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Activity className="w-5 h-5 text-indigo-500 mr-2" /> Fraud Score Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fraudScoreBins} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip
                  formatter={(value, name, props) => {
                    if (name === 'count') return [`${value} Providers`, props.payload.label];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Fraud Score ${label === '0-50' ? '0-50' : label === '50-80' ? '50-80' : '80-100'}`}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={40}>
                  {fraudScoreBins.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inpatient vs Outpatient Claims */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 text-indigo-500 mr-2" /> Inpatient vs Outpatient Claim Ratio
          </h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={claimRatioData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  dataKey="value"
                >
                  {claimRatioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value.toLocaleString(), 'Claims Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Top High-Risk Providers Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-800">Top High-Risk Providers</h3>
            <p className="text-sm text-slate-400">Providers in the dataset ranked by predictive probability.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-sm font-bold">
                <th className="py-4 px-4 cursor-pointer hover:text-slate-700" onClick={() => handleSort('Provider')}>
                  <div className="flex items-center">Provider ID {getSortIcon('Provider')}</div>
                </th>
                <th className="py-4 px-4 cursor-pointer hover:text-slate-700" onClick={() => handleSort('prob')}>
                  <div className="flex items-center">Fraud Probability {getSortIcon('prob')}</div>
                </th>
                <th className="py-4 px-4">Risk Level</th>
                <th className="py-4 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold text-sm">
              {sortedProviders.map((provider) => (
                <tr key={provider.Provider} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 text-indigo-600 font-bold">{provider.Provider}</td>
                  <td className="py-4 px-4">{(provider.prob * 100).toFixed(4)}%</td>
                  <td className="py-4 px-4">
                    <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200">
                      High
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${provider.PotentialFraud === 'Yes'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                      {provider.PotentialFraud === 'Yes' ? 'Confirmed Fraud' : 'Under Investigation'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Performance Section */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-md">
        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center">
          <Award className="w-6 h-6 text-indigo-500 mr-2" /> Model Performance Metrics
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">

          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accuracy</h4>
              <p className="text-3xl font-black text-indigo-600 mt-2">{(datasetStats.metrics.accuracy * 100).toFixed(2)}%</p>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              The proportion of correct predictions (both fraud and non-fraud) among the total number of cases examined.
            </p>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Precision</h4>
              <p className="text-3xl font-black text-indigo-600 mt-2">{(datasetStats.metrics.precision * 100).toFixed(2)}%</p>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              The proportion of identified providers that are actual fraud cases (reduces false alarm rates).
            </p>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recall</h4>
              <p className="text-3xl font-black text-indigo-600 mt-2">{(datasetStats.metrics.recall * 100).toFixed(2)}%</p>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              The proportion of actual fraud cases that the model correctly identified (maximizes detection rates).
            </p>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">F1 Score</h4>
              <p className="text-3xl font-black text-indigo-600 mt-2">{(datasetStats.metrics.f1 * 100).toFixed(2)}%</p>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              The harmonic mean of precision and recall, representing a balanced metric for highly imbalanced datasets.
            </p>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ROC-AUC</h4>
              <p className="text-3xl font-black text-indigo-600 mt-2">{(datasetStats.metrics.rocAuc * 100).toFixed(2)}%</p>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              Area under the ROC curve, measuring the model's ability to distinguish between fraud and non-fraud classes.
            </p>
          </div>

        </div>

        {/* Confusion Matrix */}
        <div className="border-t border-slate-100 pt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
              <BookOpen className="w-5 h-5 text-indigo-500 mr-2" /> Confusion Matrix (Test Split)
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              A confusion matrix layout displaying classification results of the logistic regression model on the test partition (20% split). Correct predictions are situated along the diagonal (True Negatives & True Positives).
            </p>
          </div>

          {/* Matrix Grid */}
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto w-full">
            <div className="bg-indigo-50 border border-indigo-100/50 rounded-2xl p-6 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">True Negative (TN)</span>
              <p className="text-2xl font-black text-slate-800 mt-2">{datasetStats.confusionMatrix.tn}</p>
              <p className="text-xs text-slate-400 mt-1">Predicted Non-Fraud, Actual Non-Fraud</p>
            </div>

            <div className="bg-rose-50 border border-rose-100/50 rounded-2xl p-6 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">False Positive (FP)</span>
              <p className="text-2xl font-black text-rose-600 mt-2">{datasetStats.confusionMatrix.fp}</p>
              <p className="text-xs text-slate-400 mt-1">Predicted Fraud, Actual Non-Fraud</p>
            </div>

            <div className="bg-rose-50 border border-rose-100/50 rounded-2xl p-6 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">False Negative (FN)</span>
              <p className="text-2xl font-black text-rose-600 mt-2">{datasetStats.confusionMatrix.fn}</p>
              <p className="text-xs text-slate-400 mt-1">Predicted Non-Fraud, Actual Fraud</p>
            </div>

            <div className="bg-indigo-50 border border-indigo-100/50 rounded-2xl p-6 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">True Positive (TP)</span>
              <p className="text-2xl font-black text-slate-800 mt-2">{datasetStats.confusionMatrix.tp}</p>
              <p className="text-xs text-slate-400 mt-1">Predicted Fraud, Actual Fraud</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
