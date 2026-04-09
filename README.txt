Páginas de autenticação para o projeto Ciclos
Domínio: https://profellysson.com.br

Arquivos:
- login.html
- criar-conta.html
- esqueci-senha.html
- redefinir-senha.html

URLs do site:
- https://profellysson.com.br/login.html
- https://profellysson.com.br/criar-conta.html
- https://profellysson.com.br/esqueci-senha.html
- https://profellysson.com.br/redefinir-senha.html

============================================================
SUPABASE — Configuração
============================================================

1. Authentication > Sign In / Providers
   - Deixe Email habilitado
   - Ative "Confirm email"

2. Authentication > URL Configuration
   - Site URL: https://profellysson.com.br/
   - Redirect URLs (adicione todos):
     * https://profellysson.com.br/
     * https://profellysson.com.br/login.html
     * https://profellysson.com.br/criar-conta.html
     * https://profellysson.com.br/esqueci-senha.html
     * https://profellysson.com.br/redefinir-senha.html

3. Authentication > SMTP (configurar envio pelo Brevo)
   - Enable Custom SMTP: ON
   - Host: smtp-relay.brevo.com
   - Port: 587
   - Username: contato@profellysson.com.br
   - Password: (chave de API SMTP do Brevo — não a senha da conta)
     > No Brevo: SMTP & API > Chaves de API > Criar nova chave SMTP
   - Sender name: Prof. Ellysson (ou o nome que preferir)
   - Sender email: contato@profellysson.com.br

   Observação: o e-mail remetente deve ser exatamente o domínio
   verificado no Brevo (profellysson.com.br), caso contrário
   as mensagens podem cair no spam ou ser recusadas.

============================================================
HOSTINGER — Deploy (etapa futura)
============================================================

- Faça upload de todos os arquivos .html para a pasta public_html
- O index.html principal vai para public_html/index.html
- As páginas de auth vão para public_html/ também (mesmo nível)
- Não é necessário nenhum servidor backend — tudo é estático

============================================================
