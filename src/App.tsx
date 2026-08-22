import { useState } from 'react';
import Terminal from './terminal/Terminal';
import BootScreen from './components/BootScreen';

export default function App() {
  const [booted, setBooted] = useState(false);

  return (
    <>
      <Terminal />
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}
    </>
  );
}
