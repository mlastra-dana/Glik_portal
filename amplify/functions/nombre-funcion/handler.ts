interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export const handler = async (event: unknown): Promise<LambdaResponse> => {
  try {
    const timestamp = new Date().toISOString();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        function: 'nombre-funcion',
        message: 'Lambda ejecutada correctamente',
        timestamp,
        event
      })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error no controlado';

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: false,
        function: 'nombre-funcion',
        message: 'Falló la ejecución de la Lambda',
        error: message
      })
    };
  }
};
