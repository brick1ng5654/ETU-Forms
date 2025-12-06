import { SurveyCreatorWidget } from "./Creator.jsx";
import './App.css';
function App() {
  return (
    <div className="body">
      <div className="header">
        <h1>ETU Forms</h1>
      </div>
      
      <div className="form_creator">
      <SurveyCreatorWidget /> {/* creator */}
      </div>
      
    </div>
  );
}

export default App;
