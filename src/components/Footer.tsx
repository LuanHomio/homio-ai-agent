'use client';

export function Footer() {
  return (
    <div className="bg-gray-900 border-t border-gray-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-6">
            Recursos Principais
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
              <div className="text-xl mb-2">🎯</div>
              <div className="font-medium text-white text-sm">Personalização</div>
              <div className="text-xs text-gray-400">Configure personalidade e objetivos</div>
            </div>
            
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
              <div className="text-xl mb-2">📚</div>
              <div className="font-medium text-white text-sm">Knowledge Base</div>
              <div className="text-xs text-gray-400">Integre fontes de conhecimento</div>
            </div>
            
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
              <div className="text-xl mb-2">🔗</div>
              <div className="font-medium text-white text-sm">Integração</div>
              <div className="text-xs text-gray-400">Conecte com Dify e outras APIs</div>
            </div>
            
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
              <div className="text-xl mb-2">📊</div>
              <div className="font-medium text-white text-sm">Monitoramento</div>
              <div className="text-xs text-gray-400">Acompanhe performance em tempo real</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
