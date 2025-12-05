import { SurveyCreator, SurveyCreatorComponent } from "survey-creator-react";
import "survey-core/survey-core.min.css";
import "survey-creator-core/survey-creator-core.min.css";

const creatorOptions = {
  showLogicTab: false,
};

export function SurveyCreatorWidget() {
  const creator = new SurveyCreator(creatorOptions);
  return <SurveyCreatorComponent creator={creator} />;
}
