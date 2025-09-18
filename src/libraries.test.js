import {Libraries, PythonClass, PythonConstructorMethod, PythonParameters} from './libraries.js';

test('constructor with default string tuple values', () => {
    let libraries = new Libraries({'pgzero':{"class pgzero.actor.Actor(pgzero.rect.Rect)": [
            "__init__(self, image: str, pos: tuple(int, int), anchor: tuple(float | str, float | str) = ('center', 'center')): None",
    ]}})
    let actor = libraries.resolve('pgzero.actor.Actor')
    expect(actor).toBeInstanceOf(PythonClass);
    expect(actor.name).toBe('Actor');
    expect(actor.fullName).toBe('pgzero.actor.Actor');

    let actor_init = actor.members.get('__init__')
    expect(actor_init).toBeInstanceOf(PythonConstructorMethod);
    let actor_init_params = actor_init.parameters;
    expect(actor_init_params).toBeInstanceOf(PythonParameters);
    expect(actor_init_params.length).toBe(4);

    expect(actor_init_params[0].name).toBe('self');
    expect(actor_init_params[1].name).toBe('image');
    expect(actor_init_params[2].name).toBe('pos');
    expect(actor_init_params[3].name).toBe('anchor');

    expect(actor_init_params[0].typeHint).toBe(null);
    expect(actor_init_params[1].typeHint.toString()).toBe('str');
    expect(actor_init_params[2].typeHint.toString()).toBe('tuple(int, int)');
    expect(actor_init_params[3].typeHint.toString()).toBe('tuple(float | str, float | str)');
});

test('builtin class without package', () =>
{
    let libraries = new Libraries({
        'builtin math': {
            "class int(numbers.Integral)": [
                "__init__(self, value: int | str = 0, /, base: int = 10): None",
            ]
        }
    });

    let int_class = libraries.resolve('int')
    expect(int_class).toBeInstanceOf(PythonClass);
    expect(int_class.name).toBe('int');
    expect(int_class.fullName).toBe('int');
    let int_init = int_class.members.get('__init__')
    expect(int_init.name).toBe('__init__');
    expect(int_init.fullName).toBe('int.__init__');
});
