export interface InputGamepadButtonBinding {
  type: 'button';
  btn: number;
}

export interface InputGamepadAxisBinding {
  type: 'axis';
  axis: number;
  dir: -1 | 1;
}

export type InputBinding = string | InputGamepadButtonBinding | InputGamepadAxisBinding | null;

export type InputAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'pause';

export type InputBindingMap = Record<InputAction, [InputBinding, InputBinding]>;

export type ActionState = Record<InputAction, boolean>;

export const formatBindingName = (binding: InputBinding): string => {
  if (!binding) return '---';

  if (typeof binding === 'object') {
    if (binding.type === 'button') {
      const btnMap: Record<number, string> = {
        0: 'GP:A',
        1: 'GP:B',
        2: 'GP:X',
        3: 'GP:Y',
        4: 'GP:LB',
        5: 'GP:RB',
        6: 'GP:LT',
        7: 'GP:RT',
        8: 'GP:Back',
        9: 'GP:Start'
      };
      return btnMap[binding.btn] ?? `GP:B${binding.btn}`;
    }
    const dir = binding.dir > 0 ? '+' : '-';
    return `GP:A${binding.axis}${dir}`;
  }

  const keyMap: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Escape: 'Esc',
    Enter: 'Enter',
    Space: 'Space',
    Backspace: 'Backspace',
    Delete: 'Delete'
  };

  if (keyMap[binding]) return keyMap[binding];
  if (binding.startsWith('Key')) return binding.slice(3);
  if (binding.startsWith('Digit')) return binding.slice(5);
  if (binding.startsWith('Numpad')) return `Num${binding.slice(6)}`;
  return binding;
};

export const getConnectedGamepad = (): Gamepad | null => {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gamepad of gamepads) {
    if (gamepad) {
      return gamepad;
    }
  }
  return null;
};

export const bindingMatchesGamepad = (binding: InputBinding, gamepad: Gamepad | null): boolean => {
  if (!binding || typeof binding !== 'object' || !gamepad) {
    return false;
  }
  const axisThreshold = 0.5;
  if (binding.type === 'button') {
    return !!gamepad.buttons[binding.btn]?.pressed;
  }
  const value = gamepad.axes[binding.axis] ?? 0;
  return binding.dir < 0 ? value < -axisThreshold : value > axisThreshold;
};

export const isActionPressed = (
  action: InputAction,
  bindings: InputBindingMap,
  keys: Record<string, boolean>,
  gamepad: Gamepad | null = getConnectedGamepad()
): boolean => {
  const actionBindings = bindings[action];

  const checkBinding = (binding: InputBinding): boolean => {
    if (!binding) return false;
    if (typeof binding === 'string') {
      return !!keys[binding];
    }
    return bindingMatchesGamepad(binding, gamepad);
  };

  return checkBinding(actionBindings[0]) || checkBinding(actionBindings[1]);
};

export const getMenuActionState = (bindings: InputBindingMap, keys: Record<string, boolean>): ActionState => {
  return {
    left: isActionPressed('left', bindings, keys),
    right: isActionPressed('right', bindings, keys),
    up: isActionPressed('up', bindings, keys),
    down: isActionPressed('down', bindings, keys),
    confirm: isActionPressed('confirm', bindings, keys),
    back: isActionPressed('back', bindings, keys),
    pause: isActionPressed('pause', bindings, keys)
  };
};

export const getActionEdges = (prevState: ActionState | null, currentState: ActionState): ActionState => {
  return {
    left: !!currentState.left && !(prevState?.left ?? false),
    right: !!currentState.right && !(prevState?.right ?? false),
    up: !!currentState.up && !(prevState?.up ?? false),
    down: !!currentState.down && !(prevState?.down ?? false),
    confirm: !!currentState.confirm && !(prevState?.confirm ?? false),
    back: !!currentState.back && !(prevState?.back ?? false),
    pause: !!currentState.pause && !(prevState?.pause ?? false)
  };
};
