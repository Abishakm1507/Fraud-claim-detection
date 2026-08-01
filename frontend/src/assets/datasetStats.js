export const datasetStats = {
  totalProviders: 5410,
  fraudCount: 506,
  nonFraudCount: 4904,
  avgFraudScore: 26.69,
  riskLevels: {
    Low: 4496,
    Medium: 385,
    High: 529
  },
  inpatientClaims: 40474,
  outpatientClaims: 517737,
  avgChronic: 4.54,
  reimbursement: {
    fraud: 584350.04,
    nonFraud: 53193.72
  },
  topProviders: [
    { Provider: "PRV56560", prob: 1.0, PotentialFraud: "Yes" },
    { Provider: "PRV55462", prob: 1.0, PotentialFraud: "Yes" },
    { Provider: "PRV52019", prob: 1.0, PotentialFraud: "Yes" },
    { Provider: "PRV51459", prob: 1.0, PotentialFraud: "Yes" },
    { Provider: "PRV56416", prob: 0.9999999999999998, PotentialFraud: "Yes" },
    { Provider: "PRV54742", prob: 0.9999999999999998, PotentialFraud: "Yes" },
    { Provider: "PRV54367", prob: 0.9999999999999996, PotentialFraud: "Yes" },
    { Provider: "PRV52340", prob: 0.9999999999999993, PotentialFraud: "Yes" },
    { Provider: "PRV55209", prob: 0.9999999999999891, PotentialFraud: "Yes" },
    { Provider: "PRV53706", prob: 0.9999999999999816, PotentialFraud: "Yes" }
  ],
  metrics: {
    accuracy: 0.8937153419593346,
    precision: 0.4635416666666667,
    recall: 0.8811881188118812,
    f1: 0.6075085324232082,
    rocAuc: 0.9622430132921549
  },
  confusionMatrix: {
    tn: 878,
    fp: 103,
    fn: 12,
    tp: 89
  }
};
