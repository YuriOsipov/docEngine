import { normOptions, clinicalDiagnosisOptions } from './norm-options.js';
import { ophthalmologyDiagnoses } from './ophthalmology-diagnoses.js';
import {
  acuityOptions,
  sphOptions,
  cylOptions,
  axOptions,
  boOptions,
} from './vision-values.js';
import { ophthalmologyComplaintsTree } from './ophthalmology-complaints-tree.js';
import { lifeAnamnesisTree } from './life-anamnesis-tree.js';

/** Ophthalmology domain catalogs for createEditor({ catalogs }) */
export const ophthalmologyCatalogs = {
  lists: {
    norm: {
      id: 'norm',
      label: 'Norm / pathology',
      items: normOptions,
    },
    clinicalDiagnosis: {
      id: 'clinicalDiagnosis',
      label: 'Clinical diagnosis',
      items: clinicalDiagnosisOptions,
    },
    icd10: {
      id: 'icd10',
      label: 'ICD-10',
      items: ophthalmologyDiagnoses,
      withCode: true,
    },
    acuity: {
      id: 'acuity',
      label: 'Visual acuity',
      items: acuityOptions,
    },
    sph: {
      id: 'sph',
      label: 'Sphere',
      items: sphOptions,
    },
    cyl: {
      id: 'cyl',
      label: 'Cylinder',
      items: cylOptions,
    },
    ax: {
      id: 'ax',
      label: 'Axis',
      items: axOptions,
    },
    bo: {
      id: 'bo',
      label: 'B/B',
      items: boOptions,
    },
  },
  trees: {
    complaints: {
      id: 'complaints',
      label: 'Complaints',
      tree: ophthalmologyComplaintsTree,
    },
    lifeAnamnesis: {
      id: 'lifeAnamnesis',
      label: 'Life history',
      tree: lifeAnamnesisTree,
    },
  },
};

export { ophthalmologyDiagnoses } from './ophthalmology-diagnoses.js';
