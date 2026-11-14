/** Mensagens do Supabase Auth traduzidas para o lojista (nunca mostrar texto técnico em inglês). */
const MAP: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar. Procure a mensagem da ComandaZero na caixa de entrada ou no spam."],
  [/already registered|already been registered|user already exists/i, "Este e-mail já tem conta. Entre ou recupere a senha."],
  [/password should be at least|weak password|password is too weak/i, "Senha fraca: use pelo menos 8 caracteres, misturando letras e números."],
  [/same password|different from the old/i, "A nova senha precisa ser diferente da atual."],
  [/rate limit|too many requests|for security purposes, you can only request/i, "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."],
  [/invalid email|unable to validate email/i, "Informe um e-mail válido."],
  [/expired|invalid.*(token|link|otp)|otp.*(expired|invalid)/i, "Link vencido ou já usado. Peça um novo."],
  [/signups not allowed|signup is disabled/i, "Cadastro temporariamente fechado. Fale com o suporte."],
  [/network|fetch failed|failed to fetch/i, "Sem conexão com o servidor. Confira a internet e tente de novo."],
];

export function authErrorPt(message: string) {
  return MAP.find(([re]) => re.test(message))?.[1] ?? "Não foi possível concluir agora. Tente de novo em instantes.";
}
