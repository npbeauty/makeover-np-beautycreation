const CONFIG = {
MIN_BOOKING: 1000,
CURRENCY: 'INR',
RAZORPAY_KEY_ID: 'rzp_test_YOUR_KEY', // replace or serve from server
PAYPAL_CLIENT_ID: 'Ad33RyyNKEdoaMPVLJFHzJusy48JD1HYvYP2HaA5pQIWIKJsiTUBAlzUFJgWAS75-gA28yQ4rO1CZMWB', // replace
STRIPE_PUBLIC_KEY: 'pk_live_51P31cn09e2v364nuJC8gcLGwb808rnW8CRTeC7cuoqOHDBfebn8l2W9WIRMpE1hoDFsTek0yEMIB5HZWvh8rjcxi00YKObQ1fX' // replace
};

document.addEventListener('DOMContentLoaded', () => {
const serviceBtns = document.querySelectorAll('.select-service');
const selectedServicesEl = document.getElementById('selectedServices');
const totalAmountInput = document.getElementById('totalAmount');
const minAmountInput = document.getElementById('minAmount');
const payFullCheckbox = document.getElementById('payFull');
const summaryList = document.getElementById('summaryList');
const summaryAmount = document.getElementById('summaryAmount');

let selectedServices = [];

minAmountInput.value = `₹${CONFIG.MIN_BOOKING}`;
updateUI();

serviceBtns.forEach(btn => {
btn.addEventListener('click', () => {
const card = btn.closest('.service-card');
const name = card.querySelector('h5').textContent.trim();
const price = Number(card.querySelector('.price').dataset.price);
const idx = selectedServices.findIndex(s => s.name === name);
if(idx === -1){
selectedServices.push({name, price});
btn.classList.replace('btn-outline-primary','btn-primary');
btn.textContent = 'Selected';
} else {
selectedServices.splice(idx,1);
btn.classList.replace('btn-primary','btn-outline-primary');
btn.textContent = 'Select';
}
updateUI();
});
});

payFullCheckbox.addEventListener('change', updateUI);

function calcTotal(){
const sum = selectedServices.reduce((a,b)=>a+b.price,0);
if(payFullCheckbox.checked) return sum;
const deposit = Math.ceil(sum * 0.25);
return Math.max(deposit || 0, CONFIG.MIN_BOOKING);
}

function updateUI(){
if(selectedServices.length === 0){
selectedServicesEl.textContent = 'No services selected';
summaryList.textContent = 'No services selected';
} else {
selectedServicesEl.innerHTML = selectedServices.map(s => `${s.name} — ₹${s.price}`).join('<br>');
summaryList.innerHTML = selectedServices.map(s => `${s.name} — ₹${s.price}`).join('<br>');
}
const total = calcTotal();
totalAmountInput.value = `₹${total}`;
summaryAmount.textContent = `₹${total}`;
}

function collectForm(){
const name = document.getElementById('name').value.trim();
const phone = document.getElementById('phone').value.trim();
const email = document.getElementById('email').value.trim();
const date = document.getElementById('date').value;
const notes = document.getElementById('notes').value.trim();
if(!name || !phone || !date || selectedServices.length===0){
alert('Please fill required fields: name, phone, date and select at least one service.');
return null;
}
return { name, phone, email, date, notes, services: selectedServices, amount: calcTotal(), payFull: payFullCheckbox.checked, currency: CONFIG.CURRENCY };
}

// Razorpay
document.getElementById('razorpayBtn').addEventListener('click', async () => {
const data = collectForm();
if(!data) return;
try {
const resp = await axios.post('/create-razorpay-order', { amount: data.amount*100, currency: CONFIG.CURRENCY, booking: data });
const order = resp.data;
const options = {
key: CONFIG.RAZORPAY_KEY_ID,
amount: order.amount,
currency: order.currency,
name: 'NP Beauty Creation',
description: `Booking for ${data.name}`,
order_id: order.id,
prefill: { name: data.name, contact: data.phone, email: data.email },
handler: async (razorResp) => {
try {
const verify = await axios.post('/verify-razorpay-payment', { razor: razorResp, booking: data });
if(verify.data.success) window.location.href = '/success.html';
else window.location.href = '/failure.html';
} catch {
window.location.href = '/failure.html';
}
}
};
const rzp = new Razorpay(options);
rzp.open();
} catch {
alert('Failed to initialize Razorpay order.');
}
});

// Stripe
document.getElementById('stripeBtn').addEventListener('click', async () => {
const data = collectForm();
if(!data) return;
try {
const resp = await axios.post('/create-stripe-session', { booking: data, amount: data.amount, currency: CONFIG.CURRENCY });
const stripe = Stripe(CONFIG.STRIPE_PUBLIC_KEY);
await stripe.redirectToCheckout({ sessionId: resp.data.id });
} catch {
alert('Stripe initialization failed.');
}
});

// PayPal
(function renderPayPal(){
if(!CONFIG.PAYPAL_CLIENT_ID || CONFIG.PAYPAL_CLIENT_ID.includes('YOUR')){
document.getElementById('paypal-container').innerHTML = '<button class="btn btn-outline-dark" disabled>PayPal (configure)</button>';
return;
}
const s = document.createElement('script');
s.src = `https://www.paypal.com/sdk/js?client-id=${CONFIG.PAYPAL_CLIENT_ID}&currency=${CONFIG.CURRENCY}`;
s.onload = () => {
paypal.Buttons({
createOrder: (data, actions) => {
const form = collectForm();
if(!form) return;
return actions.order.create({ purchase_units: [{ description: `Booking: ${form.services.map(s=>s.name).join(', ')}`, amount: { currency_code: CONFIG.CURRENCY, value: String(form.amount) } }] });
},
onApprove: (data, actions) => actions.order.capture().then(details => axios.post('/capture-paypal-payment',{details}).then(res => res.data.success ? window.location.href='/success.html' : window.location.href='/failure.html').catch(()=>window.location.href='/failure.html')),
onError: err => { console.error(err); alert('PayPal error'); }
}).render('#paypal-container');
};
document.body.appendChild(s);
})();

});
