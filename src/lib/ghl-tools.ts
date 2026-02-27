export const ghlTools = [
  {
    functionDeclarations: [
      {
        name: "ghl_get_custom_fields",
        description: "Busca a lista de campos personalizados (custom fields) disponíveis na GoHighLevel para contatos ou oportunidades. Use esta ferramenta para descobrir os IDs dos campos antes de tentar atualizá-los.",
        parameters: {
          type: "object",
          properties: {
            locationId: { type: "string", description: "O ID da location na GHL" },
            model: { type: "string", enum: ["contact", "opportunity"], description: "O modelo de dados para buscar os campos" }
          },
          required: ["locationId"]
        }
      },
      {
        name: "ghl_manage_contact",
        description: "Ferramenta central para gerenciar contatos na GHL. Pode atualizar dados básicos, campos personalizados, adicionar/remover tags, criar notas e inserir em workflows, tudo em uma única chamada.",
        parameters: {
          type: "object",
          properties: {
            locationId: { type: "string" },
            contactId: { type: "string" },
            updates: {
              type: "object",
              description: "Campos para atualizar (firstName, lastName, email, phone, customFields). No caso de customFields, envie um array de objetos com {id, field_value}.",
              properties: {
                firstName: { type: "string" },
                lastName: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                customFields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "O ID único do campo (ex: P74dKqnZ9F05...)" },
                      key: { type: "string", description: "A chave do campo (ex: contact.cpf ou opportunity.quantidade)" },
                      field_value: { type: "string", description: "O valor a ser gravado no campo" }
                    },
                    required: ["id", "field_value"]
                  }
                }
              }
            },
            tags: { type: "array", items: { type: "string" }, description: "Tags para ADICIONAR" },
            removeTags: { type: "array", items: { type: "string" }, description: "Tags para REMOVER" },
            notes: { type: "array", items: { type: "string" }, description: "Lista de notas/comentários para criar no histórico" },
            workflowId: { type: "string", description: "ID do workflow para inserir o contato" }
          },
          required: ["locationId", "contactId"]
        }
      },
      {
        name: "ghl_get_conversation",
        description: "Obtém os detalhes técnicos de uma conversa específica (status, participantes, etc).",
        parameters: {
          type: "object",
          properties: {
            locationId: { type: "string" },
            conversationId: { type: "string" }
          },
          required: ["locationId", "conversationId"]
        }
      }
    ]
  }
];

export const TOOL_TO_EDGE_FUNCTION: Record<string, string> = {
  "ghl_get_custom_fields": "ghl-get-custom-fields",
  "ghl_manage_contact": "ghl-manage-contact",
  "ghl_get_conversation": "ghl-get-conversation"
};

