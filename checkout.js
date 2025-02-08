document.getElementById('checkout-btn').addEventListener('click', function() {

    const requestData = {

        frequency: 'ONE_TIME',

        methods: ['PIX'],

        products: [

            {

                externalId: 'food-001',

                name: 'food ignite',

                description: 'solicitação de comida',

                quantity: 1,

                price: 5000

            }

        ],

        returnUrl: 'https://ignite-restaurant-kappa.vercel.app/',

        completionUrl: 'https://www.instagram.com/ignite_restaurant/?utm_source=ig_web_button_share_sheet',

        customer: { email: 'carlosdomingos93@gmail.com' },

        customerId: 'Ignite'

    };


    fetch('http://localhost:3000/api/checkout', {

        method: 'POST',

        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify(requestData)

    })

    .then(res => res.json())

    .then(res => {

        console.log('Resposta do servidor:', res);

        // Aqui você pode adicionar lógica para lidar com a resposta

        // Por exemplo, redirecionar o usuário ou mostrar uma mensagem de sucesso

    })

    .catch(err => {

        console.error('Erro ao fazer a requisição:', err);

    });

});