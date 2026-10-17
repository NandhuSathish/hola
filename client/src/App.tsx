import { useRoute } from './lib/route';
import { useRoom } from './lib/useRoom';
import { Home } from './screens/Home';
import { Games } from './screens/Games';
import { Lobby } from './screens/Lobby';

export function App() {
  const route = useRoute();
  const code = route.screen === 'home' ? null : route.code;
  const room = useRoom(code);

  switch (route.screen) {
    case 'games':
      return <Games room={room} code={route.code} />;
    case 'lobby':
      return <Lobby room={room} code={route.code} />;
    default:
      return <Home room={room} />;
  }
}
