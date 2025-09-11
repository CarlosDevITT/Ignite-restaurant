// Configuração do Supabase - SUBSTITUA COM SUAS CREDENCIAIS
const supabaseUrl = 'https://qgnqztsxfeugopuhyioq.supabase.co' // Substitua pela sua URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA' // Substitua pela sua chave
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

// Estado da aplicação
let isLoading = false
let isEditing = false

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  // Configurar listeners
  setupEventListeners()
  // Carregar produtos
  loadProducts()
})

// Configurar event listeners
function setupEventListeners() {
  // Mostrar/ocultar campos de promoção
  document.getElementById('product-promo').addEventListener('change', function() {
    document.getElementById('promo-fields').classList.toggle('hidden', !this.checked)
  })
  
  // Alternar categoria para promoção
  document.getElementById('product-category').addEventListener('change', function() {
    if (this.value === 'promocao') {
      document.getElementById('product-promo').checked = true
      document.getElementById('promo-fields').classList.remove('hidden')
    }
  })
}

// Alternar visibilidade do formulário
function toggleForm() {
  const form = document.getElementById('product-form')
  form.classList.toggle('hidden')
  
  if (form.classList.contains('hidden')) {
    cancelEdit()
  }
}

// Testar conexão com Supabase
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Erro na conexão com Supabase:', error)
      showError('Conexão com o banco de dados falhou. Verifique o console para detalhes.')
    } else {
      console.log('Conexão com Supabase estabelecida com sucesso')
    }
  } catch (error) {
    console.error('Erro ao testar conexão:', error)
    showError('Erro inesperado ao conectar com o banco de dados.')
  }
}

// Enviar formulário
document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  
  if (isLoading) return
  
  const product = {
    name: document.getElementById('product-name').value,
    description: document.getElementById('product-description').value,
    price: parseFloat(document.getElementById('product-price').value),
    category: document.getElementById('product-category').value,
    image_url: document.getElementById('product-image').value || null,
    featured: document.getElementById('product-featured').checked,
    available: document.getElementById('product-available').checked,
    promo: document.getElementById('product-promo').checked,
    promo_price: document.getElementById('product-promo-price').value ? 
                 parseFloat(document.getElementById('product-promo-price').value) : null,
    promo_text: document.getElementById('product-promo-text').value || null
  }
  
  // Se estiver editando, adicionar ID
  const productId = document.getElementById('product-id').value
  if (productId) {
    product.id = productId
  }
  
  // Validação adicional
  if (!product.name || !product.price || !product.category) {
    showError('Preencha todos os campos obrigatórios.')
    return
  }
  
  if (product.price <= 0) {
    showError('O preço deve ser maior que zero.')
    return
  }
  
  if (product.promo && !product.promo_price) {
    showError('Para produtos em promoção, é necessário informar o preço promocional.')
    return
  }
  
  setLoadingState(true)
  
  try {
    let result
    if (productId) {
      // Atualizar produto existente
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', productId)
        .select()
      
      result = { data, error }
    } else {
      // Criar novo produto
      product.created_at = new Date().toISOString()
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
      
      result = { data, error }
    }
    
    if (result.error) {
      console.error('Erro detalhado do Supabase:', result.error)
      throw result.error
    }
    
    await Swal.fire({
      title: 'Sucesso!',
      text: `Produto ${productId ? 'atualizado' : 'cadastrado'} com sucesso.`,
      icon: 'success',
      confirmButtonText: 'OK'
    })
    
    resetForm()
    loadProducts() // Recarregar a lista
  } catch (error) {
    console.error('Erro ao salvar produto:', error)
    showError(`Não foi possível ${productId ? 'atualizar' : 'cadastrar'} o produto. Verifique o console para detalhes.`)
  } finally {
    setLoadingState(false)
  }
})

// Carregar produtos
async function loadProducts() {
  setProductsLoadingState(true)
  
  try {
    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    
    // Aplicar filtro de categoria se selecionado
    const categoryFilter = document.getElementById('category-filter').value
    if (categoryFilter) {
      query = query.eq('category', categoryFilter)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Erro ao carregar produtos:', error)
      showError('Erro ao carregar produtos. Verifique o console para detalhes.')
      return
    }
    
    updateProductsList(data)
  } catch (error) {
    console.error('Erro inesperado ao carregar produtos:', error)
    showError('Erro inesperado ao carregar produtos.')
  } finally {
    setProductsLoadingState(false)
  }
}

// Atualizar a lista de produtos na UI
function updateProductsList(products) {
  const productsList = document.getElementById('products-list')
  const emptyProducts = document.getElementById('empty-products')
  const loadingProducts = document.getElementById('loading-products')
  
  // Ocultar loading
  loadingProducts.classList.add('hidden')
  
  if (!products || products.length === 0) {
    productsList.classList.add('hidden')
    emptyProducts.classList.remove('hidden')
    return
  }
  
  emptyProducts.classList.add('hidden')
  productsList.classList.remove('hidden')
  
  productsList.innerHTML = products.map(product => `
    <div class="product-card border rounded-lg p-4 flex flex-col relative">
      ${product.promo ? '<div class="promo-badge"><i class="fas fa-tag"></i></div>' : ''}
      <div class="flex items-center space-x-4 mb-3">
        ${product.image_url ? `
          <img src="${product.image_url}" alt="${product.name}" class="w-16 h-16 object-cover rounded">
        ` : `
          <div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
            <span class="text-gray-400 text-xs">Sem imagem</span>
          </div>
        `}
        <div class="flex-1">
          <h3 class="font-bold">${product.name}</h3>
          <p class="text-sm text-gray-600 truncate">${product.description || 'Sem descrição'}</p>
          <div class="flex items-center space-x-2 mt-1">
            <span class="text-xs px-2 py-1 bg-gray-100 rounded">${formatCategory(product.category)}</span>
            ${product.promo && product.promo_price ? `
              <span class="text-sm font-medium text-red-600">R$ ${product.promo_price.toFixed(2)}</span>
              <span class="text-sm text-gray-400 line-through">R$ ${product.price.toFixed(2)}</span>
            ` : `
              <span class="text-sm font-medium">R$ ${product.price.toFixed(2)}</span>
            `}
          </div>
        </div>
      </div>
      ${product.promo_text ? `<p class="text-xs bg-yellow-100 text-yellow-800 p-2 rounded mb-3">${product.promo_text}</p>` : ''}
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs ${product.available ? 'text-green-600' : 'text-red-600'}">
          <i class="fas ${product.available ? 'fa-check-circle' : 'fa-times-circle'}"></i>
          ${product.available ? 'Disponível' : 'Indisponível'}
        </span>
        <span class="text-xs ${product.featured ? 'text-purple-600' : 'text-gray-500'}">
          <i class="fas ${product.featured ? 'fa-star' : 'fa-star'}"></i>
          ${product.featured ? 'Em destaque' : 'Comum'}
        </span>
      </div>
      <div class="flex justify-between space-x-2 mt-auto">
        <button onclick="editProduct(${product.id})" class="text-sm bg-blue-100 text-blue-600 px-3 py-1 rounded flex-1">
          <i class="fas fa-edit mr-1"></i> Editar
        </button>
        <button onclick="toggleAvailability(${product.id}, ${!product.available})" class="text-sm ${product.available ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} px-3 py-1 rounded flex-1">
          <i class="fas ${product.available ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i>
          ${product.available ? 'Desativar' : 'Ativar'}
        </button>
        <button onclick="deleteProduct(${product.id})" class="text-sm bg-red-100 text-red-600 px-3 py-1 rounded">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('')
}

// Formatar categoria para exibição
function formatCategory(category) {
  const categories = {
    'entrada': 'Entrada',
    'principal': 'Principal',
    'bebida': 'Bebida',
    'sobremesa': 'Sobremesa',
    'promocao': 'Promoção'
  }
  return categories[category] || category
}

// Editar produto
async function editProduct(id) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    
    // Preencher formulário com dados do produto
    document.getElementById('product-id').value = data.id
    document.getElementById('product-name').value = data.name
    document.getElementById('product-description').value = data.description || ''
    document.getElementById('product-price').value = data.price
    document.getElementById('product-category').value = data.category
    document.getElementById('product-image').value = data.image_url || ''
    document.getElementById('product-featured').checked = data.featured
    document.getElementById('product-available').checked = data.available
    document.getElementById('product-promo').checked = data.promo || false
    document.getElementById('product-promo-price').value = data.promo_price || ''
    document.getElementById('product-promo-text').value = data.promo_text || ''
    
    // Mostrar campos de promoção se necessário
    document.getElementById('promo-fields').classList.toggle('hidden', !data.promo)
    
    // Alterar texto do botão
    document.getElementById('button-text').textContent = 'Atualizar Produto'
    
    // Mostrar formulário se estiver oculto
    document.getElementById('product-form').classList.remove('hidden')
    
    isEditing = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    console.error('Erro ao carregar produto para edição:', error)
    showError('Não foi possível carregar os dados do produto.')
  }
}

// Cancelar edição
function cancelEdit() {
  resetForm()
  document.getElementById('product-form').classList.add('hidden')
}

// Resetar formulário
function resetForm() {
  document.getElementById('product-form').reset()
  document.getElementById('product-id').value = ''
  document.getElementById('promo-fields').classList.add('hidden')
  document.getElementById('button-text').textContent = 'Cadastrar Produto'
  isEditing = false
}

// Alternar disponibilidade do produto
async function toggleAvailability(id, available) {
  try {
    const { error } = await supabase
      .from('products')
      .update({ available })
      .eq('id', id)
    
    if (error) throw error
    
    await Swal.fire({
      title: 'Sucesso!',
      text: `Produto ${available ? 'ativado' : 'desativado'} com sucesso.`,
      icon: 'success',
      confirmButtonText: 'OK'
    })
    
    loadProducts() // Recarregar a lista
  } catch (error) {
    console.error('Erro ao alterar disponibilidade:', error)
    showError('Não foi possível alterar a disponibilidade do produto.')
  }
}

// Excluir produto
async function deleteProduct(id) {
  const result = await Swal.fire({
    title: 'Tem certeza?',
    text: "Você não poderá reverter esta ação!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  })
  
  if (!result.isConfirmed) return
  
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    await Swal.fire({
      title: 'Excluído!',
      text: 'O produto foi excluído com sucesso.',
      icon: 'success',
      confirmButtonText: 'OK'
    })
    
    loadProducts() // Recarregar a lista
  } catch (error) {
    console.error('Erro ao excluir produto:', error)
    showError('Não foi possível excluir o produto.')
  }
}

// Gerenciar estado de loading do formulário
function setLoadingState(loading) {
  isLoading = loading
  const button = document.getElementById('submit-button')
  const buttonText = document.getElementById('button-text')
  const buttonSpinner = document.getElementById('button-spinner')
  
  if (loading) {
    button.disabled = true
    button.classList.add('opacity-75')
    buttonText.textContent = isEditing ? 'Atualizando...' : 'Cadastrando...'
    buttonSpinner.classList.remove('hidden')
  } else {
    button.disabled = false
    button.classList.remove('opacity-75')
    buttonText.textContent = isEditing ? 'Atualizar Produto' : 'Cadastrar Produto'
    buttonSpinner.classList.add('hidden')
  }
}

// Gerenciar estado de loading da lista de produtos
function setProductsLoadingState(loading) {
  const refreshSpinner = document.getElementById('refresh-spinner')
  const productsList = document.getElementById('products-list')
  const loadingProducts = document.getElementById('loading-products')
  const emptyProducts = document.getElementById('empty-products')
  
  if (loading) {
    refreshSpinner.classList.remove('hidden')
    productsList.classList.add('hidden')
    emptyProducts.classList.add('hidden')
    loadingProducts.classList.remove('hidden')
  } else {
    refreshSpinner.classList.add('hidden')
  }
}

// Mostrar erro genérico
function showError(message) {
  Swal.fire({
    title: 'Erro!',
    text: message,
    icon: 'error',
    confirmButtonText: 'OK'
  })
}

// Torna as funções globais para uso nos botões
window.toggleAvailability = toggleAvailability
window.deleteProduct = deleteProduct
window.loadProducts = loadProducts
window.editProduct = editProduct
window.toggleForm = toggleForm
window.cancelEdit = cancelEdit
