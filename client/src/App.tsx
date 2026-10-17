import { useRoute } from './lib/route';
import { useRoom } from './lib/useRoom';
import { Home } from './screens/Home';
import { Room } from './screens/Room';

export function App() {
  const route = useRoute();
  const code = route.screen === 'room' ? route.code : null;
  const room = useRoom(code);

  if (route.screen === 'room') {
    return <Room room={room} code={route.code} />;
  }
  return <Home room={room} />;
}
