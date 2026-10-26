import { useEffect } from 'react';
import { useRoute } from './lib/route';
import { useRoom } from './lib/useRoom';
import { NavBar } from './components/NavBar';
import { ReactionLayer } from './components/Reactions';
import { Home } from './screens/Home';
import { Games } from './screens/Games';
import { RoomScreen } from './screens/RoomScreen';

export function App() {
  const route = useRoute();
  const code = route.screen === 'home' ? null : route.code;
  const room = useRoom(code);

  const view = room.room;
  // One way out, in the one place that is on every screen.
  const inRoom = Boolean(view);

  /*
   * The lobby and the table are the same URL, so the router's own scroll
   * reset does not fire between them — and being dealt a hand while halfway
   * down the lobby is the same problem it solves.
   */
  const phase = view?.phase ?? null;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  return (
    <>
      <NavBar
        code={view?.code ?? code}
        gameId={view?.gameId ?? null}
        connection={room.connection}
        onLeave={inRoom ? () => room.leaveRoom() : undefined}
        /* Only in a room: there is nobody to react to on the way in. */
        onReact={inRoom ? room.react : undefined}
      />
      <Screen route={route} room={room} />

      <ReactionLayer reactions={room.reactions} onDone={room.clearReaction} />
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
