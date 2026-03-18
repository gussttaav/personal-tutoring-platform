// Server Component — pure content, no interactivity.
// Imported by both the dedicated policy pages (RSC) and FooterModals (client).
// This is the single source of truth for all policy text.

export function PrivacidadContent() {
  return (
    <>
      <p>Tu privacidad es importante. Esta política explica qué datos se recogen y cómo se usan.</p>

      <h3>Datos que se recogen</h3>
      <ul>
        <li><strong>Nombre y email</strong> — al iniciar sesión con Google o al realizar una compra, para gestionar tu cuenta y tus reservas.</li>
        <li><strong>Datos de pago</strong> — gestionados exclusivamente por Stripe. Nunca se almacenan datos de tarjeta.</li>
        <li><strong>Créditos y reservas</strong> — el saldo de clases compradas se guarda en una base de datos segura asociada a tu email.</li>
      </ul>

      <h3>Cómo se usan</h3>
      <ul>
        <li>Para gestionar tu acceso, reservas y saldo de clases.</li>
        <li>Para enviarte confirmaciones y recordatorios de clase (vía Cal.com).</li>
        <li>No se venden datos a terceros ni se usan con fines publicitarios.</li>
      </ul>

      <h3>Servicios de terceros</h3>
      <ul>
        <li><strong>Google OAuth</strong> — inicio de sesión. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de Google</a>.</li>
        <li><strong>Stripe</strong> — procesamiento de pagos. <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer">Política de Stripe</a>.</li>
        <li><strong>Cal.com</strong> — gestión de reservas y recordatorios.</li>
        <li><strong>Upstash Redis</strong> — almacenamiento del saldo de créditos.</li>
      </ul>

      <h3>Tus derechos</h3>
      <p>Puedes solicitar la eliminación de tus datos en cualquier momento escribiendo a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Cookies</h3>
      <p>Solo se usan cookies estrictamente necesarias para la autenticación (NextAuth). Sin cookies de seguimiento ni publicidad.</p>

      <h3>Cambios en esta política</h3>
      <p>Cualquier cambio relevante se comunicará por email a los usuarios con cuenta activa.</p>
    </>
  );
}

export function TerminosContent() {
  return (
    <>
      <p>Al reservar una sesión o adquirir un pack en este sitio, aceptas las condiciones que se describen a continuación.</p>

      <h3>Servicio</h3>
      <p>Gustavo Torres Guerrero ofrece clases particulares y consultoría en línea en las materias descritas en este sitio. Las sesiones se realizan por <strong>Google Meet</strong> u otra plataforma acordada entre las partes.</p>

      <h3>Pagos</h3>
      <p>Los pagos se procesan de forma segura a través de <strong>Stripe</strong>. No se almacenan datos de tarjeta. Se aceptan Visa, Mastercard y American Express. Al realizar un pago aceptas también los <a href="https://stripe.com/es/legal" target="_blank" rel="noopener noreferrer">términos de Stripe</a>.</p>

      <h3>Packs de clases</h3>
      <p>Los packs son de uso personal e intransferibles. La validez es de <strong>6 meses</strong> desde la fecha de compra. Los créditos no utilizados al vencimiento caducan sin derecho a reembolso.</p>

      <h3>Cancelaciones y reembolsos</h3>
      <p>Puedes cancelar o reprogramar cualquier clase con al menos <strong>2 horas de antelación</strong> sin coste. Para las clases de pack, el crédito se devuelve automáticamente. Para sesiones individuales pagadas, el reembolso se tramita manualmente en un plazo de 1–3 días hábiles. Las cancelaciones con menos de 2 horas de antelación o las no presentaciones sin aviso no dan derecho a reembolso.</p>

      <h3>Responsabilidad</h3>
      <p>Las clases están orientadas a la formación y apoyo académico. No se garantizan resultados académicos específicos ni se asume responsabilidad por el uso que el alumno haga de los contenidos aprendidos.</p>

      <h3>Propiedad intelectual</h3>
      <p>Los materiales, ejercicios y recursos compartidos durante las sesiones son para uso exclusivo del alumno y no pueden distribuirse ni publicarse sin autorización expresa.</p>

      <h3>Modificaciones</h3>
      <p>Gustavo Torres Guerrero se reserva el derecho de actualizar estos términos. Los cambios relevantes se comunicarán con antelación razonable.</p>

      <h3>Contacto</h3>
      <p>Para cualquier consulta sobre estos términos escribe a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>
    </>
  );
}

export function CancelacionContent() {
  return (
    <>
      <p>Puedes cancelar o reprogramar cualquier clase con al menos <strong>2 horas de antelación</strong> sin ningún coste.</p>

      <h3>Clases de pack</h3>
      <p>Si cancelas con suficiente antelación, el crédito se devuelve automáticamente a tu pack y queda disponible para reservar otra clase. Los créditos no caducan de forma anticipada por cancelar — simplemente vuelven a tu saldo.</p>

      <h3>Sesiones individuales pagadas</h3>
      <p>Si cancelas con al menos 2 horas de antelación, Gustavo tramitará el reembolso manualmente en un plazo de 1–3 días hábiles. Si la cancelación se hace con menos de 2 horas de antelación o no se presenta sin aviso previo, no se realizará reembolso.</p>

      <h3>Validez de los packs</h3>
      <p>Los packs tienen una validez de <strong>6 meses</strong> desde la fecha de compra. Los créditos no consumidos dentro de ese plazo caducan. Las cancelaciones dentro del período de validez siempre devuelven el crédito.</p>

      <h3>Encuentro inicial gratuito</h3>
      <p>El encuentro de 15 minutos es gratuito y se puede cancelar o reprogramar sin límite de tiempo previo.</p>

      <h3>Cómo cancelar o reprogramar</h3>
      <p>Usa el enlace de cancelación o reprogramación incluido en el email de confirmación de Cal.com, o escribe directamente a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Casos especiales</h3>
      <p>Si surge un imprevisto de última hora, escribe a contacto@gustavoai.dev. Gustavo lo resolverá de forma flexible siempre que sea posible.</p>
    </>
  );
}
