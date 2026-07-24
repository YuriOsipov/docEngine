export const lifeAnamnesisTree = [
  {
    id: 'chronic',
    label: 'Chronic conditions',
    children: [
      { id: 'chronic-dm', label: 'diabetes mellitus' },
      { id: 'chronic-htn', label: 'hypertension' },
      { id: 'chronic-thyroid', label: 'thyroid disease' },
    ],
  },
  {
    id: 'allergy',
    label: 'Allergy',
    children: [
      { id: 'allergy-drug', label: 'to medications' },
      { id: 'allergy-season', label: 'seasonal' },
    ],
  },
  {
    id: 'surgery',
    label: 'Eye surgery',
  },
  {
    id: 'trauma',
    label: 'Eye trauma',
  },
  {
    id: 'hereditary',
    label: 'Family history',
    children: [
      { id: 'hereditary-glaucoma', label: 'glaucoma' },
      { id: 'hereditary-myopia', label: 'myopia' },
    ],
  },
  {
    id: 'occupation',
    label: 'Occupational hazards',
  },
  {
    id: 'normal',
    label: 'Unremarkable',
  },
];
