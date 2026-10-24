import lab from './assets/lab.png';
import sat from './assets/satellite.png';
import earth from './assets/earth-night.png';

export const SKINS = ['earth', 'mars', 'neptune', 'europa', 'uranus', 'saturn'];

export const vision = "Egypt is a responsible user of outer space, able to carry out space missions that serve national development and security objectives and to take an active part in global space initiatives. Egypt will be capable of deep-space missions to explore and use space resources.";
export const mission = "To promote the peaceful use of space and develop national space systems by investing in human capital, supporting research and development, driving innovation and strengthening space outreach, delivering reliable, responsive and economically viable solutions that serve national objectives.";
export const quality = [
 'Create, transfer, localize and develop space technology and national satellite capabilities.',
 'Promote the peaceful use of space, human-capital development, research, innovation and public awareness.',
 'Invest in technology, workforce training and knowledge transfer.',
 'Operate an Aerospace Quality Management System (AQMS) aligned with AS9100:2016, customer requirements and applicable legal requirements.',
 'Review quality objectives and management-system effectiveness periodically.',
 'Communicate the policy to relevant stakeholders and review it during management reviews.'];

export const programs = [
  {
    slug: 'space-fundamentals',
    status: 'published',
    category: 'Introductory',
    planetSkin: 'earth',
    title: 'Space Fundamentals',
    tagline: 'Explore the Foundations of Space Science and Technology',
    subtitle: '2-Day Intensive Training Program',
    duration: '2 days',
    level: 'Beginner / STEM',
    image: lab,
    summary: 'An intensive 2-day curriculum introducing participants to orbital mechanics, space mission design, satellite subsystems, and space environmental challenges through interactive lectures and practical engineering demonstrations.',
    audience: ['School students', 'Early university students', 'STEM enthusiasts', 'Beginners interested in space technology'],
    overview: [
      'This introductory program gives participants an overview of space science, space missions and satellite technologies. It builds curiosity and foundational knowledge in preparation for more advanced programs in space engineering and related fields.',
      'Participants explore how missions are designed, learn the basic structure of a satellite, and study the space environment through interactive sessions and practical activities.'
    ],
    objectives: [
      'Understand basic space science and the solar system',
      'Identify types of space missions and their applications',
      'Recognize the main components of a satellite',
      'Understand the challenges of the space environment',
      'Gain initial exposure to mission-design concepts',
      'Develop teamwork and problem-solving skills'
    ],
    days: [
      {
        title: 'Day 1: Introduction to Space & Missions',
        focus: 'Foundations and exploration',
        items: [
          'Ice-breaking and team formation',
          'Interactive introduction to space science and the solar system',
          'Overview of communication, Earth-observation and exploration missions',
          'Case study of notable space missions',
          'Hands-on: develop a simple mission concept',
          'Group discussion: "Why do we go to space?"'
        ]
      },
      {
        title: 'Day 2: Satellites & Space Environment',
        focus: 'Understanding space systems',
        items: [
          'Satellite basics and subsystems: EPS, ADCS, communication and payload',
          'Demonstration with satellite models or educational kits',
          'The space environment: vacuum, radiation and temperature',
          'Hands-on satellite-component identification',
          'Group exercise: design a basic satellite mission',
          'Final presentations and feedback'
        ]
      }
    ],
    methodology: ['Interactive lectures', 'Visual demonstrations', 'Hands-on activities', 'Group-based learning', 'Mini design challenges'],
    tools: ['Satellite models or mockups', 'Space simulation videos', 'Basic mission-design templates', 'Educational satellite kits (subject to availability)', 'Demonstrations of simple communication concepts'],
    materials: { available: [], planned: ['Introductory handbook (PDF)', 'Lecture slides', 'Mission-design worksheets', 'Digital examples, videos and references'] },
    prerequisites: 'No prior experience is required. A basic interest in science and technology is recommended.',
    certification: 'Participants receive an official Certificate of Completion from the Egyptian Space Academy.',
    evaluation: ['Engagement', 'Group activities', 'Final presentation']
  },
  {
    slug: 'space-systems',
    status: 'published',
    category: 'Technology',
    planetSkin: 'mars',
    title: 'Space Systems Engineering',
    tagline: 'Architecting End-to-End Satellite Subsystems and Spacecraft Architecture',
    subtitle: 'Comprehensive Systems Engineering Curriculum',
    duration: '2 days',
    level: 'Intermediate / University',
    image: sat,
    summary: 'Comprehensive curriculum focusing on satellite systems engineering, subsystem integration, mission trade studies, power and link budgets, and technical requirements management.',
    audience: ['Engineering students', 'Aerospace practitioners', 'Hardware and firmware designers'],
    overview: [
      'Space Systems Engineering provides an in-depth view into how modern spacecraft are architected, integrated, and verified against rigorous aerospace standards.',
      'Participants study core satellite subsystems—including Electrical Power Subsystem (EPS), Attitude Determination and Control Subsystem (ADCS), Command & Data Handling (C&DH), and Telemetry, Tracking & Command (TT&C).'
    ],
    objectives: [
      'Formulate mission requirements and functional spacecraft architecture',
      'Calculate spacecraft power, thermal, and delta-V budgets',
      'Analyze subsystem trade-offs for CubeSats and small satellites',
      'Understand aerospace integration and verification workflows (AIT)'
    ],
    days: [
      {
        title: 'Day 1: Spacecraft Architecture & Subsystem Trade Studies',
        focus: 'System requirements and bus design',
        items: [
          'Space systems engineering fundamentals and lifecycle phases',
          'EPS, thermal, and mechanical structures design principles',
          'ADCS sensors and actuators selection criteria',
          'Spacecraft mass and power margin calculations'
        ]
      },
      {
        title: 'Day 2: Verification, Integration & Launch Readiness',
        focus: 'Testing and flight readiness',
        items: [
          'Interface control documents (ICDs) and communication protocols',
          'Environmental testing: thermal vacuum, vibration, and EMC/EMI',
          'Hardware-in-the-loop (HIL) simulation exercises',
          'System review and flight readiness evaluation'
        ]
      }
    ],
    methodology: ['Technical lectures', 'Subsystem design exercises', 'Hardware-in-the-loop case studies', 'Peer design reviews'],
    tools: ['Spacecraft CAD & block diagram suites', 'Orbital simulation tools', 'Satellite subsystem mockups', 'Power and link budget calculators'],
    materials: { available: [], planned: ['Systems Engineering Guidebook (PDF)', 'Subsystem Trade Study Templates', 'Link & Power Budget Sheets'] },
    prerequisites: 'Foundational understanding of electrical, mechanical, or computer engineering.',
    certification: 'Egyptian Space Academy Certificate of Completion in Space Systems Engineering.',
    evaluation: ['Subsystem trade study exercise', 'Design review presentation', 'Technical evaluation']
  },
  {
    slug: 'remote-sensing',
    status: 'published',
    category: 'Engineering',
    planetSkin: 'neptune',
    title: 'Remote Sensing & Earth Observation',
    tagline: 'Analyzing Satellite Imagery for National Development and Resource Management',
    subtitle: 'Applied Earth Observation and Spectral Analysis',
    duration: '3 days',
    level: 'Intermediate / Professional',
    image: earth,
    summary: 'Practical training on multispectral satellite imagery, spectral analysis, image preprocessing, and radiometric calibration for environmental, agricultural, and urban monitoring.',
    audience: ['Earth observation analysts', 'GIS specialists', 'Environmental researchers', 'Survey engineers'],
    overview: [
      'This program covers the physics of optical and radar remote sensing, satellite payload sensors, and computational workflows required to transform raw downlinked telemetry into actionable geospatial intelligence.',
      'Participants learn to analyze multispectral bands, compute vegetation indices (NDVI), assess urban growth patterns, and monitor water resources.'
    ],
    objectives: [
      'Understand electromagnetic radiation interactions with atmospheric and surface features',
      'Process multispectral and hyperspectral satellite imagery',
      'Calculate vegetation, water, and urban indices',
      'Apply radiometric calibration and geometric corrections to raw sensor data'
    ],
    days: [
      {
        title: 'Day 1: Principles of Satellite Remote Sensing',
        focus: 'Optical physics and payload sensors',
        items: [
          'Electromagnetic spectrum and atmospheric transmission windows',
          'Orbital geometries for Earth observation: SSO and GEO constellations',
          'Payload sensor specifications: spatial, spectral, radiometric, and temporal resolution',
          'Introduction to open-access and national satellite missions'
        ]
      },
      {
        title: 'Day 2: Image Processing & Spectral Analysis',
        focus: 'Digital image processing algorithms',
        items: [
          'Preprocessing: atmospheric correction and orthorectification',
          'Multispectral band combinations and spectral signature curves',
          'Vegetation indices calculation (NDVI, NDRE) and interpretation',
          'Supervised and unsupervised classification algorithms'
        ]
      },
      {
        title: 'Day 3: National Geospatial Applications',
        focus: 'Real-world problem solving',
        items: [
          'Agricultural monitoring: crop health and irrigation tracking',
          'Water resource monitoring and coastline dynamics assessment',
          'Urban expansion and geological topography modeling',
          'Final group case study and analytical briefing'
        ]
      }
    ],
    methodology: ['Geospatial laboratory sessions', 'Hands-on dataset processing', 'Interactive case studies', 'Real-world satellite data analysis'],
    tools: ['GIS software suites (QGIS / SNAP)', 'Satellite multispectral datasets', 'Jupyter notebooks with GDAL/Rasterio', 'Spectral library tools'],
    materials: { available: [], planned: ['Earth Observation Laboratory Manual', 'Sample Multispectral Datasets', 'Remote Sensing Worksheets'] },
    prerequisites: 'Basic familiarity with GIS concepts or digital data analysis.',
    certification: 'Egyptian Space Academy Certificate in Applied Remote Sensing.',
    evaluation: ['Laboratory data processing exercises', 'Geospatial case study report']
  },
  {
    slug: 'satellite-ops',
    status: 'published',
    category: 'Technology',
    planetSkin: 'europa',
    title: 'Satellite Operations & Ground Control',
    tagline: 'Mission Control, Telemetry Analysis, and Telecommand Verification',
    subtitle: 'Operational Spacecraft Flight Operations',
    duration: '4 days',
    level: 'Advanced / Engineering',
    image: sat,
    summary: 'Real-time telemetry monitoring, telecommand verification, ground station scheduling, orbital pass tracking, and anomaly response procedures.',
    audience: ['Satellite controllers', 'Mission operations engineers', 'Ground station technicians', 'Aerospace students'],
    overview: [
      'Satellite Operations trains participants in the procedures and systems required to safely operate orbiting spacecraft throughout their operational lifecycle.',
      'Students step inside simulated mission control workflows, planning contact passes, analyzing health and housekeeping telemetry, generating telecommands, and troubleshooting simulated in-orbit anomalies.'
    ],
    objectives: [
      'Interpret housekeeping and payload telemetry packets',
      'Schedule ground station antenna passes and track orbital passes',
      'Formulate and verify encrypted telecommand sequences',
      'Implement contingency and anomaly recovery procedures'
    ],
    days: [
      {
        title: 'Day 1: Ground Segment Architecture & Link Budget',
        focus: 'Antennas, receivers and tracking',
        items: [
          'Ground station architecture: UHF/VHF, S-band, and X-band systems',
          'Orbital pass prediction and Doppler frequency compensation',
          'Two-Line Element (TLE) propagation and antenna pointing angles',
          'RF link budget calculations for ground-to-space links'
        ]
      },
      {
        title: 'Day 2: Telemetry & Telecommand (TM/TC) Protocols',
        focus: 'CCSDS standards and packet structures',
        items: [
          'CCSDS packet telemetry and telecommand standards',
          'Real-time telemetry decommutation and limit checking',
          'Command verification, acknowledgment, and execution loops',
          'Payload data downlink scheduling and management'
        ]
      },
      {
        title: 'Day 3: Mission Planning & Orbit Maintenance',
        focus: 'Flight dynamics and passes',
        items: [
          'Orbit maintenance: drag compensation and station-keeping manoeuvres',
          'Power management: eclipse duty cycle planning',
          'Payload observation scheduling and data storage management',
          'Pass execution drill in simulated mission control console'
        ]
      },
      {
        title: 'Day 4: Anomaly Detection & Safe Mode Recovery',
        focus: 'Fault management and contingencies',
        items: [
          'Spacecraft fault management systems (FDIR)',
          'Root cause analysis of simulated ADCS and power anomalies',
          'Safe mode recovery execution and contingency procedures',
          'Final mission operations simulation and assessment'
        ]
      }
    ],
    methodology: ['Simulated mission control operations', 'Real-time console drills', 'Telemetry decoding exercises', 'Anomaly response scenarios'],
    tools: ['Ground station tracking simulation software', 'Telemetry packet analyzers (CCSDS compatible)', 'Orbital propagation tools', 'Simulated mission control displays'],
    materials: { available: [], planned: ['Flight Operations Handbook (PDF)', 'CCSDS Protocol Quick Reference', 'Mission Control Checklist Templates'] },
    prerequisites: 'Completion of Space Fundamentals or Space Systems Engineering, or equivalent background.',
    certification: 'Egyptian Space Academy Certificate in Satellite Flight Operations.',
    evaluation: ['Simulated pass execution drill', 'Anomaly resolution exercise', 'Operations logbook review']
  },
  {
    slug: 'gnss',
    status: 'published',
    category: 'Engineering',
    planetSkin: 'uranus',
    title: 'Navigation & GNSS Constellations',
    tagline: 'Satellite Constellations, Precision Positioning, and Signal Architecture',
    subtitle: 'Space-Based Positioning, Navigation, and Timing (PNT)',
    duration: '5 days',
    level: 'Intermediate / Advanced',
    image: sat,
    summary: 'Deep dive into Global Navigation Satellite Systems architectures, constellation orbits, signal propagation, positioning algorithms, and differential corrections.',
    audience: ['Navigation engineers', 'Telecommunications researchers', 'Robotics and autonomous systems developers'],
    overview: [
      'Global Navigation Satellite Systems (GNSS) are fundamental to modern space navigation, terrestrial transportation, precision agriculture, and sovereign defense infrastructures.',
      'This course covers the space segment, control segment, and user segment of GPS, Galileo, GLONASS, and BeiDou constellations, examining signal structures, pseudorange estimation, and multi-constellation fusion.'
    ],
    objectives: [
      'Analyze GNSS constellation orbits, clock synchronization, and ephemerides',
      'Calculate user position from pseudorange and carrier-phase measurements',
      'Mitigate atmospheric delays (ionosphere and troposphere) and multipath errors',
      'Implement Differential GNSS (DGNSS) and Real-Time Kinematic (RTK) techniques'
    ],
    days: [
      {
        title: 'Day 1: GNSS Space & Control Architecture',
        focus: 'Constellations and orbital mechanics',
        items: [
          'Overview of GPS, Galileo, GLONASS, and BeiDou',
          'MEO orbits, ground tracks, and constellation geometries',
          'Atomic clocks, relativistic effects, and time transfer',
          'Broadcast ephemeris structure and satellite position computation'
        ]
      },
      {
        title: 'Day 2: Signals & RF Receiver Architectures',
        focus: 'Signal modulation and tracking loops',
        items: [
          'L-band signal structures, PRN codes, and BPSK/BOC modulations',
          'Receiver front-end: downconversion, filtering, and sampling',
          'Signal acquisition, carrier tracking (PLL), and code tracking (DLL)',
          'Measurement extraction: pseudorange, carrier phase, and Doppler'
        ]
      },
      {
        title: 'Day 3: Positioning Algorithms & Error Sources',
        focus: 'Navigation mathematics and corrections',
        items: [
          'Least-squares and Extended Kalman Filter (EKF) positioning algorithms',
          'Geometric Dilution of Precision (GDOP/PDOP/HDOP)',
          'Atmospheric delay models: Klobuchar and Saastamoinen models',
          'Multipath mitigation and antenna design considerations'
        ]
      },
      {
        title: 'Day 4: High-Precision Positioning (RTK / PPP)',
        focus: 'Carrier-phase differential GNSS',
        items: [
          'Differential GNSS (DGNSS) and base station architectures',
          'Real-Time Kinematic (RTK) and integer carrier phase ambiguity resolution',
          'Precise Point Positioning (PPP) with precise satellite orbits and clocks',
          'Satellite-Based Augmentation Systems (SBAS: EGNOS, WAAS)'
        ]
      },
      {
        title: 'Day 5: Spacecraft Navigation & Jamming/Spoofing Defense',
        focus: 'Spaceborne receivers and resilience',
        items: [
          'GNSS receivers in Low Earth Orbit (LEO): orbit determination and timing',
          'Spacecraft attitude determination using multi-antenna GNSS',
          'Vulnerability assessment: jamming, spoofing, and spoofing detection',
          'Final design challenge: multi-constellation receiver configuration'
        ]
      }
    ],
    methodology: ['Mathematical formulation lectures', 'Receiver SDR lab sessions', 'Data analysis of RINEX files', 'Practical positioning exercises'],
    tools: ['Software Defined Radio (SDR) receivers', 'GNSS simulation datasets', 'RINEX processing tools (RTKLIB / Python)', 'Constellation visualization software'],
    materials: { available: [], planned: ['GNSS Principles Handbook', 'RTKLIB Hands-on Tutorial', 'Sample RINEX Datasets and Processing Scripts'] },
    prerequisites: 'Background in mathematics, signal processing, or telecommunications engineering.',
    certification: 'Egyptian Space Academy Certificate in GNSS Systems.',
    evaluation: ['RINEX dataset processing challenge', 'Signal analysis assignment', 'Technical presentation']
  },
  {
    slug: 'cybersecurity',
    status: 'published',
    category: 'Technology',
    planetSkin: 'saturn',
    title: 'Space Cybersecurity & Asset Defense',
    tagline: 'Securing Satellite Uplinks, Downlinks, Ground Infrastructure, and Spacecraft Firmware',
    subtitle: 'Defense in Depth for Modern Space Systems',
    duration: '3 days',
    level: 'Intermediate / Advanced',
    image: lab,
    summary: 'Securing satellite communication links, command authentication, ground network vulnerability assessment, and defense against orbital cyber threats.',
    audience: ['Information security specialists', 'Ground segment engineers', 'Embedded systems developers', 'Aerospace network administrators'],
    overview: [
      'As space systems become increasingly software-defined and interconnected, space assets face expanding cyber threats spanning ground control networks, RF communication links, and on-board flight software.',
      'This specialized training program equips cybersecurity professionals and space engineers with the methods to audit, harden, and defend space segment assets against interception, spoofing, tampering, and denial-of-service attacks.'
    ],
    objectives: [
      'Identify vulnerability surfaces across space, link, and ground segments',
      'Implement cryptographic protocols for telecommand authentication and telemetry encryption',
      'Harden ground control networks and software-defined radio interfaces',
      'Conduct space-specific penetration testing and threat modeling'
    ],
    days: [
      {
        title: 'Day 1: Space Cyber Threat Landscape & Architecture',
        focus: 'Threat modeling and attack surfaces',
        items: [
          'Anatomy of space system attack vectors: uplink, downlink, and crosslinks',
          'Ground station network vulnerabilities and supply-chain risks',
          'Historic space cyber incidents and emerging geopolitical threats',
          'Space threat modeling frameworks (SPARTA / MITRE ATT&CK for Space)'
        ]
      },
      {
        title: 'Day 2: RF Link Security & Cryptographic Controls',
        focus: 'Securing the communication pipe',
        items: [
          'RF signal interception, eavesdropping, and jamming defense',
          'Telecommand authentication and anti-replay mechanisms',
          'CCSDS Space Data Link Security (SDLS) protocol implementation',
          'Key management and cryptographic renewal for space missions'
        ]
      },
      {
        title: 'Day 3: On-Board Software Hardening & Incident Response',
        focus: 'Spacecraft flight software security',
        items: [
          'Flight software vulnerabilities: buffer overflows and logic flaws in RTOS',
          'Secure boot and cryptographic firmware verification in orbit',
          'Ground segment intrusion detection and security monitoring (SIEM)',
          'Simulated cyber attack containment drill and mission recovery exercise'
        ]
      }
    ],
    methodology: ['Threat modeling workshops', 'Hands-on packet inspection labs', 'Attack-and-defense simulated scenarios', 'Policy and compliance case reviews'],
    tools: ['Network protocol analyzers (Wireshark with CCSDS dissectors)', 'Software Defined Radios (HackRF / RTL-SDR)', 'SPARTA threat matrix explorer', 'Cryptographic simulation toolkits'],
    materials: { available: [], planned: ['Space Cybersecurity Reference Architecture (PDF)', 'SPARTA Framework Cheat Sheet', 'Link Encryption Implementation Guide'] },
    prerequisites: 'Fundamental understanding of computer networks and cybersecurity principles.',
    certification: 'Egyptian Space Academy Certificate in Space Cybersecurity.',
    evaluation: ['Threat modeling assignment', 'Link security analysis lab', 'Incident response drill']
  },
  {
    slug: 'mission-design',
    status: 'published',
    category: 'Engineering',
    planetSkin: 'mars',
    title: 'Space Mission Design & Astrodynamics',
    tagline: 'End-to-End Space Mission Formulation, Launch Windows, and Trajectory Planning',
    subtitle: 'Advanced Mission Formulation & Astrodynamics',
    duration: '4 days',
    level: 'Advanced / Engineering',
    image: earth,
    summary: 'End-to-end space mission formulation, launch window calculation, trajectory optimization, delta-V budgets, and risk mitigation strategies.',
    audience: ['Mission planners', 'Aerospace engineers', 'Graduate researchers', 'Satellite project leads'],
    overview: [
      'Space Mission Design provides an intensive, holistic exploration of formulating complex space missions from initial scientific or commercial objectives through orbit selection, delta-V budgeting, and lifecycle execution.',
      'Participants work with professional astrodynamics principles, calculating orbital maneuvers, plane changes, Hohmann transfers, and interplanetary trajectories while conducting comprehensive trade studies.'
    ],
    objectives: [
      'Formulate mission operational concept (ConOps) and science requirements',
      'Calculate orbital transfers, perturbations, and total mission delta-V budget',
      'Determine launch windows and orbital insertion parameters',
      'Perform risk analysis and cost/schedule feasibility studies'
    ],
    days: [
      {
        title: 'Day 1: Mission Concept Formulation & ConOps',
        focus: 'Objectives to functional requirements',
        items: [
          'Mission formulation methodology: science questions and stakeholder needs',
          'Concept of Operations (ConOps) development',
          'Orbit classification: LEO, SSO, Molniya, GEO, and Lagrange points',
          'Payload-to-orbit matching and mission utility metrics'
        ]
      },
      {
        title: 'Day 2: Orbital Mechanics & Trajectory Analysis',
        focus: 'Astrodynamics calculations',
        items: [
          'Keplerian orbital elements and orbital perturbation forces (J2, drag, SRP)',
          'Orbital transfers: Hohmann, bi-elliptic, and plane changes',
          'Launch vehicle selection and orbital injection performance',
          'Ground track coverage and revisit time optimization'
        ]
      },
      {
        title: 'Day 3: Mission Budgets & Spacecraft Sizing',
        focus: 'Resource allocation and trade studies',
        items: [
          'Delta-V budgeting: insertion, station-keeping, attitude control, and disposal',
          'Propulsion system trade studies: cold gas, chemical, and electric propulsion',
          'End-of-life disposal and space debris mitigation compliance (IADC guidelines)',
          'Mass, power, and thermal margin calculations'
        ]
      },
      {
        title: 'Day 4: Mission Trade Studies & Final Defense',
        focus: 'Comprehensive mission design project',
        items: [
          'Risk assessment, fault tolerance, and redundancy strategies',
          'Mission schedule formulation and technology readiness levels (TRL)',
          'Collaborative group mission design exercise',
          'Formal technical defense of the mission proposal'
        ]
      }
    ],
    methodology: ['Astrodynamics lecture series', 'Computer-aided trajectory optimization', 'Collaborative mission trade study workshops', 'Formal design defense panel'],
    tools: ['NASA General Mission Analysis Tool (GMAT) / Poliastro', 'Delta-V calculators', 'Coverage simulation tools', 'Mission trade matrix templates'],
    materials: { available: [], planned: ['Space Mission Analysis & Design Guidebook', 'Mission Design Templates', 'Astrodynamics Formulae Sheet'] },
    prerequisites: 'Strong background in physics, calculus, or aerospace engineering.',
    certification: 'Egyptian Space Academy Certificate in Space Mission Formulation.',
    evaluation: ['Comprehensive delta-V budget worksheet', 'Final mission design proposal and oral defense']
  },
  {
    slug: 'electronics-training-pending',
    status: 'draft',
    category: 'Electronics',
    planetSkin: 'neptune',
    title: 'Electronics Training: Details Pending Confirmation',
    tagline: 'Circuit Analysis and Hardware Prototyping for STEM Learners',
    subtitle: 'Draft Curriculum • Awaiting Final Institutional Approval',
    duration: '3 days, 4–5 hours per day',
    level: 'Beginner / Intermediate',
    image: lab,
    summary: 'A specialized hands-on training module covering foundational circuit analysis, PCB design concepts, and embedded hardware architectures. Official syllabus and training schedule currently await final institutional confirmation.',
    audience: ['STEM learners', 'Beginners in circuit analysis', 'Electronics technicians'],
    overview: [
      'Hands-on training at the Egyptian Space Academy (on-site or hybrid) covering circuit foundations in preparation for circuit design, PCB design and embedded systems. The official title, syllabus and objectives are awaiting confirmation.'
    ],
    objectives: [
      'Understand basic circuit theory and electronic component behaviors',
      'Interpret electronic schematic diagrams and wiring configurations',
      'Introduction to printed circuit board (PCB) layouts',
      'Safety practices in electronic laboratory environments'
    ],
    days: [],
    methodology: ['Hands-on training', 'Laboratory exercises'],
    tools: ['Multimeters and oscilloscopes', 'Breadboards and electronic component kits', 'Schematic capture tools'],
    materials: { available: [], planned: [] },
    prerequisites: 'Basic electronics knowledge; completion of Electronics Fundamentals is recommended.',
    certification: 'Certificate of Attendance upon institutional approval.',
    evaluation: ['Participation', 'Exercises', 'Hands-on activities']
  }
];

export const CATEGORIES = ['All', ...new Set(programs.map(p => p.category).filter(Boolean))];

export const news = []; // Only verified items. Shape: {id,title,date,category,excerpt,image,url}

export const features=[{t:'Training & Education',d:'Building skills for the next generation of space experts'},{t:'Research & Innovation',d:'Advancing space science and technology'},{t:'Satellite Programs',d:'Supporting national space initiatives'},{t:'International Collaboration',d:'Connecting Egypt to the global space community'}];
export const highlights=[{t:'Established August 2019',d:'Public economic authority'},{t:'Law No. 3 of 2018',d:'Legal foundation'},{t:'Peaceful use of space',d:'Core mission principle'},{t:'AQMS',d:'Aligned with AS9100:2016'}];

export const trainingPillars = [
  {
    title: 'Interactive Academic Foundations',
    desc: 'Rigorous aerospace lectures covering orbital mechanics, satellite architectures, mission lifecycle design, and space physics.'
  },
  {
    title: 'Hands-on Satellite Engineering',
    desc: 'Practical laboratory sessions utilizing educational satellite kits, subsystem mockups, circuit testing, and simulation environments.'
  },
  {
    title: 'Design Challenges & Group Missions',
    desc: 'Collaborative team exercises developing mission trade studies, power budgets, link calculations, and technical presentations.'
  },
  {
    title: 'STEM & Human Capital Cultivation',
    desc: 'Empowering early university students, school STEM learners, and future engineers with verified space systems competencies.'
  }
];

export const researchPillars = [
  {
    id: 'sat-tech',
    title: 'Satellite Technology Transfer & Localization',
    lead: 'Developing national aerospace capabilities to assemble, integrate, test, and deploy satellite systems from Egyptian territory.',
    items: [
      'Assembly, Integration, and Testing (AIT) facility operations',
      'Localization of structural, thermal, and electrical power subsystems',
      'Telemetry, tracking, and control (TT&C) ground station engineering',
      'Strategic pathways toward sovereign orbital launch capabilities'
    ]
  },
  {
    id: 'space-missions',
    title: 'Earth Observation & Scientific Space Missions',
    lead: 'Designing multispectral, optical, and environmental remote-sensing payloads that serve national economic and security objectives.',
    items: [
      'Agricultural land health, coastline dynamics, and water resource monitoring',
      'Urban expansion tracking and geological topography modeling',
      'Optical payload calibration and high-speed data downlink systems',
      'Collaborative observation initiatives with regional space partners'
    ]
  },
  {
    id: 'deep-space',
    title: 'Space Resources & Deep-Space Exploration',
    lead: 'Conducting foundational astrophysical research and developing technological concepts for deep-space resource utilization.',
    items: [
      'Planetary science, lunar exploration concepts, and space physics',
      'Deep-space radiation shielding and thermal endurance analysis',
      'Autonomous navigation algorithms and interplanetary orbital mechanics',
      'Contributions to global scientific space exploration forums'
    ]
  },
  {
    id: 'space-weather',
    title: 'Space Weather & Orbital Environment Monitoring',
    lead: 'Monitoring solar activity, geomagnetic disturbances, and orbital debris to safeguard national space assets and communications.',
    items: [
      'Solar flare and coronal mass ejection (CME) disturbance tracking',
      'Ionospheric scintillation modeling for satellite communication stability',
      'Near-Earth space situational awareness (SSA) and collision avoidance',
      'Aerospace Quality Management System (AS9100:2016) verification'
    ]
  }
];

export const pressGuidelines = {
  policy: 'The Egyptian Space Agency adheres to strict institutional verification standards. In accordance with Law No. 3 of 2018 and presidential authority guidelines, all press releases, technical milestones, mission progress updates, and media advisories undergo institutional review prior to publication.',
  mediaEmail: 'info@egsa.gov.eg',
  officialPortalNews: 'https://egsa.gov.eg/activities/Media/News'
};

