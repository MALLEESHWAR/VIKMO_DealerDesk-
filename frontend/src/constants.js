// 40 Key SKUs monitored by ML Demand Forecasting & lead_times.csv
export const FORECAST_SKUS = [
  'FIL-1016', 'BRK-1090', 'BRK-1085', 'FIL-1031', 'BRK-1019',
  'ELE-1043', 'FIL-1041', 'ELE-1095', 'BRK-1021', 'CHN-1052',
  'BRK-1095', 'ELE-1031', 'OIL-1004', 'GRP-1011', 'ELE-1058',
  'ELE-1012', 'ELE-1024', 'GRP-1043', 'BRK-1112', 'OIL-1010',
  'BRK-1088', 'FIL-1032', 'GRP-1017', 'ELE-1057', 'ELE-1047',
  'GRP-1024', 'CHN-1039', 'BRK-1105', 'BRK-1060', 'CHN-1010',
  'CHN-1014', 'CHN-1006', 'ELE-1006', 'CHN-1011', 'FIL-1051',
  'ELE-1019', 'ELE-1080', 'CHN-1073', 'CHN-1071', 'BRK-1036'
];

export const isForecastSku = (sku) => FORECAST_SKUS.includes(sku);
