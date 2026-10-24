import {Routes,Route} from 'react-router-dom';
import {Header,Footer} from './components.jsx';
import {Home,About,Programs,ProgramDetail,News,Contact,NotFound,Training,Research,Login} from './pages.jsx';
export default function App(){return <><Header/><main id="main"><Routes><Route path="/" element={<Home/>}/><Route path="/about" element={<About/>}/><Route path="/programs" element={<Programs/>}/>
<Route path="/programs/:slug" element={<ProgramDetail/>}/><Route path="/news" element={<News/>}/><Route path="/contact" element={<Contact/>}/><Route path="/training" element={<Training/>}/><Route path="/research" element={<Research/>}/><Route path="/login" element={<Login/>}/><Route path="*" element={<NotFound/>}/></Routes></main><Footer/></>}
