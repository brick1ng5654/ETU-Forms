import "./styles/survey-custom.css";

import { SurveyCreator, SurveyCreatorComponent } from "survey-creator-react";

const Creator = () => {
  const creator = new SurveyCreator({ showLogicTab: false });

  // @ts-ignore — временное решение для TypeScript
  return <SurveyCreatorComponent creator={creator} />; 
};

export default Creator;

