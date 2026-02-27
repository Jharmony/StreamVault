import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Artist } from './pages/Artist';
import { Profile } from './pages/Profile';
import { CreatorTools } from './pages/CreatorTools';
import { NowPlayingBar } from './components/NowPlayingBar';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/artist/:id" element={<Artist />} />
        <Route path="/profile/:address" element={<Profile />} />
        <Route path="/creator-tools" element={<CreatorTools />} />
      </Routes>
      <NowPlayingBar />
    </Layout>
  );
}
