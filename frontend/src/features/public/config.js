// Central configuration. Empty URLs = documented integration placeholder (see INTEGRATION_CONTRACT.md).
export const config = {
  loginUrl: import.meta.env.VITE_LOGIN_URL || '',
  academyPortalUrl: import.meta.env.VITE_ACADEMY_PORTAL_URL || '',
  contactEndpoint: import.meta.env.VITE_CONTACT_ENDPOINT || '',
  languages: [{code:'en',label:'English',dir:'ltr',available:true},{code:'ar',label:'العربية',dir:'rtl',available:false}],
  nav: [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About', title: 'About EGSA' },
    { to: '/programs', label: 'Programs', title: 'Explore Space Programs' },
    { to: '/training', label: 'Training', title: 'Training & Education' },
    { to: '/research', label: 'Research', title: 'Research & Innovation' },
    { to: '/news', label: 'News', title: 'Press & Media Center' },
    { to: '/contact', label: 'Contact', title: 'Contact Egyptian Space Agency' }
  ],
  contact: {
    org:'Egyptian Space Agency', address:'Middle Ring Road, KM, New Cairo, Egypt.', email:'info@egsa.gov.eg',
    phones:['+20221297950, 994','+20221297993'], // kept exactly as supplied; confirm completeness
  },
  // Supplied source links, not yet verified as operational.
  external: [
    {label:'EGSA website',url:'https://egsa.gov.eg/'},{label:'About EGSA (official)',url:'https://egsa.gov.eg/about-us/about'},
    {label:'Official contact page',url:'https://egsa.gov.eg/contact-us'},{label:'Facilities & labs',url:'https://egsa.gov.eg/facilities/labs'},
    {label:'Official news',url:'https://egsa.gov.eg/activities/Media/News'},{label:'Vacancies',url:'https://egsa.gov.eg/vacancies/job'},
  ],
};
