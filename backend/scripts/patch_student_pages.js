const fs = require('fs');
const path = require('path');

// 1. Patch ExploreProgramsPage.jsx
const exploreFile = path.resolve(__dirname, '../../frontend/src/features/student/pages/student/ExploreProgramsPage.jsx');
let exploreContent = fs.readFileSync(exploreFile, 'utf8');

const targetUsersLi = /<li className="egsa-program-meta-item">\s*<i className="fa-solid fa-users egsa-meta-icon"><\/i>\s*<span>\s*\{course\.capacity != null[\s\S]*?<\/li>/;

const matchExplore = exploreContent.match(targetUsersLi);
if (matchExplore) {
  const replacement = matchExplore[0] + '\n                    {course.instructor && course.instructor !== \'TBD\' && (\n                      <li className="egsa-program-meta-item" data-testid={`course-instructor-${course._id}`}>\n                        <i className="fa-solid fa-chalkboard-user egsa-meta-icon"></i>\n                        <span>Instructor: {course.instructor}</span>\n                      </li>\n                    )}';
  exploreContent = exploreContent.replace(matchExplore[0], replacement);
  fs.writeFileSync(exploreFile, exploreContent, 'utf8');
  console.log('Successfully patched ExploreProgramsPage.jsx');
} else {
  console.error('Target not found in ExploreProgramsPage.jsx');
}

// 2. Patch TrainingPage.jsx to show instructor in program-meta-strip
const trainingFile = path.resolve(__dirname, '../../frontend/src/features/student/pages/student/TrainingPage.jsx');
let trainingContent = fs.readFileSync(trainingFile, 'utf8');

const targetMetaStrip = /<div className="program-meta-strip">([\s\S]*?)<\/div>/;
const matchTraining = trainingContent.match(targetMetaStrip);
if (matchTraining) {
  const inner = matchTraining[1];
  if (!inner.includes('course.instructor')) {
    const addition = '\n                    {course.instructor && course.instructor !== \'TBD\' && (\n                      <span className="program-meta-item" data-testid={`training-instructor-${course._id || program.id}`}>\n                        <i className="fa-solid fa-chalkboard-user"></i>\n                        {course.instructor}\n                      </span>\n                    )}';
    trainingContent = trainingContent.replace(matchTraining[0], `<div className="program-meta-strip">${inner}${addition}\n                  </div>`);
    fs.writeFileSync(trainingFile, trainingContent, 'utf8');
    console.log('Successfully patched TrainingPage.jsx');
  } else {
    console.log('TrainingPage.jsx already has instructor in meta strip');
  }
} else {
  console.error('Target not found in TrainingPage.jsx');
}

