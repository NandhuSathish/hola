import { useRoute } from './lib/route';
import { useRoom } from './lib/useRoom';
import { NavBar } from './components/NavBar';
import { Home } from './screens/Home';
import { Games } from './screens/Games';
import { RoomScreen } from './screens/RoomScreen';

export function App() {
  const route = useRoute();
  const code = route.screen === 'home' ? null : route.code;
  const room = useRoom(code);

  const view = room.room;
  // The lobby carries its own leave beside the invite link, so the bar only
  // offers one where the screen underneath has no other way out — which,
  // before this, mid-game meant closing the tab.
  const needsLeave = Boolean(view) && view?.phase !== 'lobby';

  return (
    <>
      <NavBar
        code={view?.code ?? code}
        gameId={view?.gameId ?? null}
        connection={room.connection}
        onLeave={needsLeave ? () => room.leaveRoom() : undefined}
      />
      <Screen route={route} room={room} />
    </>
  );
}

function Screen({
  route,
  room,
}: {
  route: ReturnType<typeof useRoute>;
  room: ReturnType<typeof useRoom>;
}) {
  switch (route.screen) {
    case 'games':
      return <Games room={room} code={route.code} />;
    case 'lobby':
      return <RoomScreen room={room} code={route.code} />;
    default:
      return <Home room={room} />;
  }
}
