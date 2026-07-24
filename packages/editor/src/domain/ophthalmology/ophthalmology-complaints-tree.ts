export const ophthalmologyComplaintsTree = [
  {
    id: 'vision',
    label: 'Vision disturbance',
    children: [
      { id: 'vision-blur', label: 'blurring' },
      { id: 'vision-decline', label: 'decreased acuity' },
      { id: 'vision-double', label: 'diplopia' },
    ],
  },
  {
    id: 'pain',
    label: 'Pain',
    children: [
      { id: 'pain-eye', label: 'in the eye' },
      { id: 'pain-brow', label: 'around the eye' },
    ],
  },
  {
    id: 'redness',
    label: 'Redness',
  },
  {
    id: 'tearing',
    label: 'Tearing',
  },
  {
    id: 'discharge',
    label: 'Discharge',
    children: [
      { id: 'discharge-mucus', label: 'mucous' },
      { id: 'discharge-pus', label: 'purulent' },
    ],
  },
  {
    id: 'itching',
    label: 'Itching',
  },
  {
    id: 'photophobia',
    label: 'Photophobia',
  },
  {
    id: 'floaters',
    label: 'Floaters',
  },
];
