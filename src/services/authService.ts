const API_URL = "https://bebidas-api-dotnet.onrender.com";

export interface LoginResponse {
  message: string;
  tokenType: string;
  token: string;
  usuario: {
    id: string;
    userName: string;
    email: string;
    roles: string[];
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("E-mail ou senha inválidos.");
    }

    if (response.status === 429) {
      throw new Error(
        "Muitas tentativas de login. Aguarde antes de tentar novamente."
      );
    }

    throw new Error("Não foi possível realizar o login.");
  }

  return response.json();
}