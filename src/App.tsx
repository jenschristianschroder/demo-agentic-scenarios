import React from 'react';
import { Routes, Route } from 'react-router-dom';
import WelcomeScreen from './pages/WelcomeScreen';
import FeaturesScreen from './pages/FeaturesScreen';
import DemoScreen from './pages/DemoScreen';
import RagDemoScreen from './pages/RagDemoScreen';
import ToolDemoScreen from './pages/ToolDemoScreen';
import RagFailureDemoScreen from './pages/RagFailureDemoScreen';
import SalesProposalDemoScreen from './pages/SalesProposalDemoScreen';
import SmartHomeDemoScreen from './pages/SmartHomeDemoScreen';
import SpotifyDemoScreen from './pages/SpotifyDemoScreen';
import SpotifyCallbackPage from './pages/SpotifyCallbackPage';
import ModelRouterDemoScreen from './pages/ModelRouterDemoScreen';
import ImageGenDemoScreen from './pages/ImageGenDemoScreen';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/features" element={<FeaturesScreen />} />
      <Route path="/demo" element={<DemoScreen />} />
      <Route path="/rag-demo" element={<RagDemoScreen />} />
      <Route path="/rag-failure-demo" element={<RagFailureDemoScreen />} />
      <Route path="/tool-demo" element={<ToolDemoScreen />} />
      <Route path="/sales-proposal-demo" element={<SalesProposalDemoScreen />} />
      <Route path="/smart-home-demo" element={<SmartHomeDemoScreen />} />
      <Route path="/spotify-demo" element={<SpotifyDemoScreen />} />
      <Route path="/spotify-callback" element={<SpotifyCallbackPage />} />
      <Route path="/model-router-demo" element={<ModelRouterDemoScreen />} />
      <Route path="/image-gen-demo" element={<ImageGenDemoScreen />} />
    </Routes>
  );
};

export default App;
