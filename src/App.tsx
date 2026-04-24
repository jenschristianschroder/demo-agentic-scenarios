import React from 'react';
import { Routes, Route } from 'react-router-dom';
import WelcomeScreen from './pages/WelcomeScreen';
import FeaturesScreen from './pages/FeaturesScreen';
import DemoScreen from './pages/DemoScreen';
import RagDemoScreen from './pages/RagDemoScreen';
import ToolDemoScreen from './pages/ToolDemoScreen';
import RagFailureDemoScreen from './pages/RagFailureDemoScreen';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/features" element={<FeaturesScreen />} />
      <Route path="/demo" element={<DemoScreen />} />
      <Route path="/rag-demo" element={<RagDemoScreen />} />
      <Route path="/rag-failure-demo" element={<RagFailureDemoScreen />} />
      <Route path="/tool-demo" element={<ToolDemoScreen />} />
    </Routes>
  );
};

export default App;
