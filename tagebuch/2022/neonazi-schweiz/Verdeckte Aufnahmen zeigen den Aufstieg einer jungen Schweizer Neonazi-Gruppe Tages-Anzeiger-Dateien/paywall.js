window._dsc = window._dsc || []
const _dscObject = (() => {
  let loaded = false

  const tenants = [
    { key: 'derbund', lang: 'de', pianoAid: 'xZyCF7VIpu', pianoDmp: '1128463737549688070' },
    { key: 'tagesanzeiger', lang: 'de', pianoAid: 'm5PazUWdpu', pianoDmp: '1128463737549688071' },
    { key: 'bernerzeitung', lang: 'de', pianoAid: 'UFwY8fonpu', pianoDmp: '1128463737549688073' },
    { key: 'bazonline', lang: 'de', pianoAid: 'CDq5SCnBpu', pianoDmp: '1128463737549688069' },
    { key: 'berneroberlaender', lang: 'de', pianoAid: 'KLoewj2Gpu', pianoDmp: '1127337835556974471' },
    { key: 'thunertagblatt', lang: 'de', pianoAid: 'SQqkfckupu', pianoDmp: '1128463737549688075' },
    { key: 'langenthalertagblatt', lang: 'de', pianoAid: 'Sqhs7z60pu', pianoDmp: '1127337835556974469' },
    { key: 'zsz', lang: 'de', pianoAid: '5SmJcLoipu', pianoDmp: '1128463737549688072' },
    { key: 'landbote', lang: 'de', pianoAid: 'B6Jiz8CIpu', pianoDmp: '1127337835556974470' },
    { key: 'zuonline', lang: 'de', pianoAid: 'LOUPhyaVpu', pianoDmp: '1129589635365483733' },
    { key: 'tdg', lang: 'fr', pianoAid: 'F3JePD8ppu', pianoDmp: '1129589635365483736' },
    { key: '24heures', lang: 'fr', pianoAid: 'SwhouE5cpu', pianoDmp: '1129589635365483734' },
    { key: 'bilan', lang: 'fr', pianoAid: 'y1OCCn56pu', pianoDmp: '1129589635365483732' }
  ]

  const tenant = tenants.find(el => window.location.hostname.includes(`${el.key}.ch`)) || {}
  const settings = {
    entitlementsBaseUrl: 'https://gateway.tamedia.ch/entitlement-service',
    identityBaseUrl: `https://abo-digital.${tenant.key}.ch/identity-service`,
  }

  const apiCall = async (url, data = {}, method = 'POST', withCredentials = true, headers = {}) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      credentials: withCredentials ? 'include' : undefined,
      body: method === 'GET' ? undefined : JSON.stringify(data)
    })

    return res.json()
  }

  const jwtDecode = token => JSON.parse(window.atob(token.split('.')[1]))

  const getEntitlements = async (url, idToken) => {
    const res = await apiCall(url, {}, 'GET', false, { Authorization: `Bearer ${idToken}`})

    if (typeof res === 'string') {
      const data = jwtDecode(res)
      const entitlements = data?.entitlements
      const pianoComposerCustomVars = data?.customVars
      return {
        hasAbo: !!entitlements.premium,
        hasAdFree: !!entitlements.adfree,
        paywallResponse: res,
        pianoComposerCustomVars,
        token: res
      }
    } else {
      return {
        hasAbo: false,
        hasAdFree: false,
        paywallResponse: res
      }
    }
  }

  const getLoginData = async (url) => {
    const res = await apiCall(url, { grantType: 'refresh_token' }, 'POST', true)

    if (res.id_token) {
      const data = jwtDecode(res.id_token)
      const { c1_user_id: id, email, sub: tamediaId, first_name: firstname, last_name: lastname } = data
      return { id, email, identityToken: res.id_token, tamediaId, firstname, lastname }
    } else {
      return res
    }
  }

  const createPlaceholderDivs = () => {
    const ids = ['piano-premium', 'piano-ribbon', 'piano-custom-css']
    ids.forEach((id) => {
      const isCss = id === 'piano-custom-css'
      let element = document.getElementById(id)
      if (!element) {
        element = document.createElement(isCss ? 'style' : 'div')
        element.id = id
        if (id === 'piano-ribbon') {
          element.cssText = ''
        }
        if (isCss) {
          element.textContent = '#piano-ribbon{position:fixed; bottom:0;z-index:999;width:100%;}#piano-premium:empty{display:none;}'
          document.head.appendChild(element)
        } else {
          document.body.appendChild(element)
        }
      }
    })
  }

  const includePianoScript = (entitlementData, loginData, data) => {
    if (!window.tp) {
      window.tp = []
    }
    const { pianoAid, pianoDmp } = tenant
    const { tp } = window
    tp.push(['setAid', pianoAid])
    tp.push(['setUseTinypassAccounts', false])
    tp.push(['setEndpoint', 'https://buy.tinypass.com/api/v3'])
    tp.push(['setUsePianoIdUserProvider', false])
    tp.push(['setUsePianoIdLiteUserProvider', true])
    if (data.darkMode) tp.push(['setCustomVariable', 'hasDarkMode', 'dark'])
    tp.push(['setLocale', tenant.lang === 'de' ? 'de_CH' : 'fr_FR'])
    tp.push(['setCxenseSiteId', pianoDmp])

    const defaultCustomVars = {
      hasEmailVerified: false,
      hasPrintDigital: false,
      hasSubscription: false,
      userType: 'anonymous',
      regTrialActive: false
    }
    const customVars = entitlementData.pianoComposerCustomVars || {}
    for (const i in defaultCustomVars) {
      const value = typeof customVars[i] === 'undefined' ? defaultCustomVars[i] : customVars[i]
      tp.push(['setCustomVariable', i, value])
      console.log(`Custom variable set: ${i}: ${value}`)
    }
    tp.push(['setTags', data.restricted ? 'premium-interactive' : 'article'])
    tp.push(['init', () => {
      window.tp?.enableGACrossDomainLinking?.()
      window.tp?.push(['setExternalJWT', loginData.identityToken])
      window.tp?.experience?.init?.()
    }])

    const getOfferFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const offerId = params.get('offerid')
      const templateParam = params.get('templateid') || ''
      if (offerId && templateParam) {
        const templateId = templateParam.split('/')[0]
        const inline = params.get('inline') || ''

        window.tp?.offer?.show?.({
          offerId,
          templateId,
          templateVariantId: templateParam.includes('/') ? templateParam.split('/').pop() : '',
          displayMode: inline ? 'inline' : 'modal',
          containerSelector: '#' + inline
        })
      }
    }

    setAnalytics(customVars, tenant.pianoAid, loginData)
    getOfferFromUrl()

    const script = document.createElement('script')
    script.src = 'https://cdn.tinypass.com/api/tinypass.min.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }

  let _data = {}
  const execute = async (data) => {
    if (!loaded) {
      loaded = true
      createPlaceholderDivs()
      const loginUrl = `${settings.identityBaseUrl}/auth/token`
      const loginData = await getLoginData(loginUrl)
      let entitlementData = {}

      if (loginData.identityToken) {
        const entitlementsUrl = `${settings.entitlementsBaseUrl}/api/entitlements?tenant=${tenant.key}`
        entitlementData = await getEntitlements(entitlementsUrl, loginData.identityToken)
      }

      includePianoScript(entitlementData, loginData, data)
      console.log('data: ', data, 'entitlementData: ', entitlementData, 'LoginData: ', loginData)
    }
  }

  const reset = () => {
    window._dsc.data = []
  }
  const push = (el) => {
    window._dsc.data.push(el)
  }
  const setData = (initialData) => {
    let data = { abo: false, restricted: false, darkMode: false }
    initialData.forEach(el => {
      if (el.length === 2) {
        data[el[0]] = el[1]
      }
    })
    data.restricted = data.abo
    _data = data
  }
  return { getData: () => _data, setData, push, reset, execute }
})()

function setAnalytics (customVars, pianoAppId, loginData) {
  let currentTemplate = {}
  const generateTransactionId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16)
      const v = c === 'x' ? r : 8 + (r % 4)
      return v.toString(16)
    })
  }
  const trackCheckoutStateChange = (data, pianoAppId, userAnalyticsData) => {
    const { term } = data;
    const plan = term.billingPlanTable?.[0];
    const originalPlan = term.originalBillingPlan;
    const currencyCode = term.chargeCurrency;
    const { isTrial = false } = plan;
    const price = originalPlan?.chargeAmount ? originalPlan.chargeAmount : term.chargeAmount;
    const products = {
      name: term.name,
      id: term.termId,
      brand: pianoAppId,
      category: term.resource.rid,
      variant: plan.shortPeriod,
      price: data.stateName === 'state2' ? term.chargeAmount : price,
      quantity: 1
    }
    let event;
    let actionField;
    const ecommerceType = data.stateName === 'receipt' ? 'purchase' : 'checkout';
    switch (data.stateName) {
      case 'state2':
        // checkout step 1
        event = 'ecommerce_checkout';
        actionField = {
          step: 1,
          option: null
        };
        break;
      case 'confirmation':
        // checkout step 2
        event = 'ecommerce_checkout';
        actionField = {
          step: 2,
          option: term.subscriptionPaymentMethods[0].paymentTypeId
        };
        break;
      case 'receipt':
        event = 'ecommerce_transaction';
        actionField = {
          id: generateTransactionId(),
          revenue: term.chargeAmount,
          tax: Math.round(term.chargeAmount * term.taxRate) / 100,
          coupon: originalPlan?.chargeAmount
                  ? originalPlan.chargeAmount > term.chargeAmount
                  : plan.originalPriceValue > plan.priceValue
        };
        break;
      default:
        break;
    }

    if (event) {
      const analyticsData = {
        event,
        ecommerce: { [ecommerceType]: { actionField, products }, currencyCode, isTrial },
        ...userAnalyticsData
      };
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push(analyticsData);
    }
  }

  const trackCheckoutCustomEvent = (event, analyticsData) => {
    const params = JSON.parse(event.params.params)
    // console.log('Checkout custom event call', event.eventName, params, event)
    const terms = JSON.parse(event.params.terms ? event.params.terms : '{}')
    let dataLayerContent
    switch (event.eventName) {
      case 'overlay_to_register':
        dataLayerContent = {
          event: event.eventName,
          overlay_button: 'toRegister',
          overlay_offerID: params.offerId,
          overlay_templateID: params.templateId,
          page: params.url
        }
        break
      default:
        dataLayerContent = {
          event: event.eventName,
          event_label: event.params.eventlabel, // piano lowercases all custom tracking variables
          termId: event.params.termindex ? terms[event.params.termindex].termId : '',
          product_category: event.params.termindex ? terms[event.params.termindex].resource.rid : '',
          button_position: event.params.position,
          overlay_dest_link: event.params.destlink ? event.params.destlink : '',
          overlay_offerID: params.offerId,
          overlay_templateID: params.templateId,
          page: params.url
        }
        break
    }

    if (dataLayerContent) {
      if (params.templateVariantId) {
        dataLayerContent.overlay_templateIVariantID = params.templateVariantId
      }
      window.dataLayer?.push({ ...dataLayerContent, ...analyticsData })
    }
  }

  const trackCheckoutClose = (event, analyticsData, currentTemplate) => {
    switch (event.state) {
      case 'close':
        // User did not complete the purchase and simply closed the modal
        window.dataLayer?.push({
          event: 'overlay_close',
          event_label: 'close',
          overlay_offerID: currentTemplate.offerId,
          overlay_templateID: currentTemplate.templateId,
          overlay_templateVariantId: currentTemplate.templateVariantId,
          ...analyticsData
        })
    }
  }
  const getUserAnalyticsData = (customVars) => {
    const userStatus = customVars.userType || 'anonymous'
    return {
      user_status: userStatus,
      user_substatus: customVars.hasSubscription ? 'subscribed' : 'unsubscribed',
      login_status: loginData?.id ? 'logged_out' : 'logged_in',
      trial_registration: customVars.regTrialActive,
      c1_id: loginData?.id
    }
  }

  const userAnalyticsData = getUserAnalyticsData(customVars)

  const showOfferCallback = (params) => {
    currentTemplate = params
    window.dataLayer?.push({
      event: 'overlay_show',
      overlay_offerID: params.offerId,
      overlay_templateID: params.templateId,
      overlay_templateVariantId: params.templateVariantId,
      ...userAnalyticsData
    })
  }

  tp.push(['addHandler', 'checkoutStateChange', (data) => {
    trackCheckoutStateChange(data, pianoAppId, userAnalyticsData)
  }])

  tp.push(['addHandler', 'showTemplate', showOfferCallback])
  tp.push(['addHandler', 'showOffer', showOfferCallback])

  tp.push(['addHandler', 'checkoutClose', (event) => {
    trackCheckoutClose(event, userAnalyticsData, currentTemplate)
  }])

  tp.push(['addHandler', 'checkoutCustomEvent', (event) => {
    trackCheckoutCustomEvent(event, userAnalyticsData)
  }])
}

window.addEventListener('load', function () { // at this point all everything pushed to window._dsc is available
  _dscObject.setData(window._dsc)
  _dscObject.execute(_dscObject.getData())
})
