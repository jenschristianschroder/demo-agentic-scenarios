import React from 'react';
import { Routes, Route } from 'react-router-dom';
import WelcomeScreen from './pages/WelcomeScreen';
import FeaturesScreen from './pages/FeaturesScreen';
import DemoScreen from './pages/DemoScreen';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/features" element={<FeaturesScreen />} />
      <Route path="/demo" element={<DemoScreen />} />
    </Routes>
  );
};

export default App;
