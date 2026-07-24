// @ts-nocheck
import { cellFieldId } from '@docengine/editor';

function choice(name, label, commonListId) {
  return { type: 'choice', name, label, multi: false, commonListId };
}

function list(name, label, commonListId, opts = {}) {
  return {
    type: opts.multi ? 'list' : 'choice',
    name,
    label,
    multi: opts.multi ?? false,
    commonListId,
    ...(opts.itemLayout ? { itemLayout: opts.itemLayout } : {}),
    ...(opts.itemPrefix != null ? { itemPrefix: opts.itemPrefix } : {}),
  };
}

function treeField(name, label, commonTreeId) {
  return { type: 'tree', name, label, commonTreeId };
}

const schemas = {
  complaints: treeField('Complaints', 'Complaints', 'complaints'),
  lifeAnamnesis: treeField('Life history', 'Life history', 'lifeAnamnesis'),
  correctionOd: choice('Correction OD', 'OD', 'norm'),
  correctionOs: choice('Correction OS', 'OS', 'norm'),
  orbitOd: choice('Orbit OD', 'OD', 'norm'),
  orbitOs: choice('Orbit OS', 'OS', 'norm'),
  eyelidsOd: choice('Eyelids OD', 'OD', 'norm'),
  eyelidsOs: choice('Eyelids OS', 'OS', 'norm'),
  ciliaryOd: choice('Ciliary margin OD', 'OD', 'norm'),
  ciliaryOs: choice('Ciliary margin OS', 'OS', 'norm'),
  conjunctivaOd: choice('Conjunctiva OD', 'OD', 'norm'),
  conjunctivaOs: choice('Conjunctiva OS', 'OS', 'norm'),
  dischargeOd: choice('Discharge OD', 'OD', 'norm'),
  dischargeOs: choice('Discharge OS', 'OS', 'norm'),
  lacrimalOd: choice('Lacrimal apparatus OD', 'OD', 'norm'),
  lacrimalOs: choice('Lacrimal apparatus OS', 'OS', 'norm'),
  patencyOd: choice('Patency OD', 'OD', 'norm'),
  patencyOs: choice('Patency OS', 'OS', 'norm'),
  scleraOd: choice('Sclera OD', 'OD', 'norm'),
  scleraOs: choice('Sclera OS', 'OS', 'norm'),
  corneaOd: choice('Cornea OD', 'OD', 'norm'),
  corneaOs: choice('Cornea OS', 'OS', 'norm'),
  anteriorChamberOd: choice('Anterior chamber OD', 'OD', 'norm'),
  anteriorChamberOs: choice('Anterior chamber OS', 'OS', 'norm'),
  irisOd: choice('Iris OD', 'OD', 'norm'),
  irisOs: choice('Iris OS', 'OS', 'norm'),
  pupilOd: choice('Pupil OD', 'OD', 'norm'),
  pupilOs: choice('Pupil OS', 'OS', 'norm'),
  lensOd: choice('Lens OD', 'OD', 'norm'),
  lensOs: choice('Lens OS', 'OS', 'norm'),
  vitreousOd: choice('Vitreous body OD', 'OD', 'norm'),
  vitreousOs: choice('Vitreous body OS', 'OS', 'norm'),
  fundusOd: choice('Fundus OD', 'OD', 'norm'),
  fundusOs: choice('Fundus OS', 'OS', 'norm'),
  vesselsOd: choice('Vessels OD', 'OD', 'norm'),
  vesselsOs: choice('Vessels OS', 'OS', 'norm'),
  retinaOd: choice('Retina OD', 'OD', 'norm'),
  retinaOs: choice('Retina OS', 'OS', 'norm'),
  visualFieldOd: choice('Visual field OD', 'OD', 'norm'),
  visualFieldOs: choice('Visual field OS', 'OS', 'norm'),
  iopOd: choice('IOP OD', 'OD', 'norm'),
  iopOs: choice('IOP OS', 'OS', 'norm'),
  icd10: {
    type: 'list',
    name: 'ICD-10',
    label: 'ICD-10',
    multi: true,
    listSource: 'remote',
    withCode: true,
    itemLayout: 'lines',
    defaultValue: [],
  },
  clinicalDiagnosis: {
    ...choice('Clinical diagnosis', 'Clinical diagnosis', 'clinicalDiagnosis'),
    displayStyle: {
      fontWeight: 'bold',
      color: '#006600',
    },
  },
};

const visionTableId = 'visionTable';
const visionColumns = [
  { key: 'vis', label: 'vis' },
  { key: 'sph', label: 'Sph' },
  { key: 'cyl', label: 'Cyl' },
  { key: 'ax', label: 'Ax' },
  { key: 'vis2', label: 'Vis' },
  { key: 'bo', label: 'B/B' },
];
const visionRows = [
  { key: 'od', label: 'OD' },
  { key: 'os', label: 'OS' },
];

const columnListMap = {
  vis: 'acuity',
  sph: 'sph',
  cyl: 'cyl',
  ax: 'ax',
  vis2: 'acuity',
  bo: 'bo',
};

schemas[visionTableId] = {
  type: 'table',
  name: 'Visual acuity',
  label: 'Visual acuity',
  columns: visionColumns,
  rows: visionRows,
  showRowLabels: true,
  cellType: 'choice',
  cellCommonListId: 'acuity',
};

for (const row of visionRows) {
  for (const col of visionColumns) {
    const id = cellFieldId(visionTableId, row.key, col.key);
    schemas[id] = choice(col.label, col.label, columnListMap[col.key] ?? 'acuity');
  }
}

export const ophthalmologySchemas = schemas;
export const visionTableFieldId = visionTableId;
